"""Codex hook adapter for Hookify's Markdown rules and Python regex matching."""

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

EVENTS = {"bash", "file", "prompt", "stop", "all"}
OPERATORS = {"regex_match", "not_regex_match", "contains", "not_contains",
             "equals", "starts_with", "ends_with"}
PATCH_HEADER = re.compile(r"^\*\*\* (Add File|Update File|Delete File|Move to): (.+)$")
MAX_RULE = 32_768
MAX_TRANSCRIPT = 262_144


@dataclass
class Rule:
    name: str
    enabled: bool
    event: str
    phase: str
    action: str
    tool_matcher: str
    conditions: list
    message: str


def property_pair(line):
    key, sep, value = line.partition(":")
    if not sep or not key.strip():
        raise ValueError("expected a frontmatter property")
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    return key.strip(), value


def parse_rule(text):
    parts = re.split(r"^---[ \t]*\r?$", text.lstrip("\ufeff"), maxsplit=2, flags=re.M)
    if len(parts) != 3 or parts[0]:
        raise ValueError("expected a Markdown rule with --- frontmatter delimiters")
    meta, conditions = {}, []
    in_conditions = False
    for line in parts[1].splitlines():
        value = line.strip()
        if not value or value.startswith("#"):
            continue
        if not line[0].isspace():
            key, value = property_pair(value)
            if key in meta or key not in {"name", "enabled", "event", "phase", "action",
                                          "pattern", "conditions", "tool_matcher"}:
                raise ValueError("unknown or repeated property: " + key)
            in_conditions = key == "conditions"
            if in_conditions and value:
                raise ValueError("use an indented conditions list")
            meta[key] = value
        elif in_conditions and value.startswith("- "):
            key, value = property_pair(value[2:])
            conditions.append({key: value})
        elif in_conditions and conditions:
            key, value = property_pair(value)
            if key in conditions[-1]:
                raise ValueError("repeated condition property: " + key)
            conditions[-1][key] = value
        else:
            raise ValueError("unexpected indented property")

    name = meta.get("name", "")
    event = meta.get("event", "all")
    phase = meta.get("phase", "pre")
    action = meta.get("action", "warn")
    enabled = meta.get("enabled", "true").lower()
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
        raise ValueError("name must be lowercase kebab-case")
    if event not in EVENTS or phase not in {"pre", "post"} or action not in {"warn", "block"}:
        raise ValueError("unsupported event, phase, or action")
    if enabled not in {"true", "false"} or (phase == "post" and event in {"prompt", "stop"}):
        raise ValueError("invalid enabled value or phase for this event")
    if "pattern" in meta:
        if "conditions" in meta:
            raise ValueError("use pattern or conditions, not both")
        default_field = {"bash": "command", "file": "new_text", "prompt": "prompt",
                         "stop": "last_assistant_message", "all": "content"}[event]
        conditions = [{"field": default_field, "pattern": meta["pattern"]}]
    if not conditions:
        raise ValueError("a rule needs a pattern or conditions")
    compiled = []
    for condition in conditions:
        field = condition.get("field", "")
        operator = condition.get("operator", "regex_match")
        pattern = condition.get("pattern", "")
        if not field or not pattern or operator not in OPERATORS or condition.keys() - {"field", "operator", "pattern"}:
            raise ValueError("invalid condition")
        if operator in {"regex_match", "not_regex_match"}:
            pattern = re.compile(pattern, re.IGNORECASE)
        compiled.append((field, operator, pattern))
    message = parts[2].strip()
    if not message:
        raise ValueError("a rule needs a message")
    return Rule(name, enabled == "true", event, phase, action,
                meta.get("tool_matcher", ""), compiled, message)


def git(cwd, *args, data=None):
    return subprocess.run(["git", "-C", str(cwd), *args], input=data,
                          capture_output=True, timeout=3, check=False)


def local_rules(cwd):
    result = git(cwd, "rev-parse", "--show-toplevel")
    if result.returncode:
        return []
    root = Path(result.stdout.decode("utf-8").rstrip("\r\n")).resolve()
    if not Path(cwd).resolve().is_relative_to(root):
        return []
    directory = root / ".codex"
    if not directory.is_dir() or directory.resolve() != directory:
        return []
    candidates = []
    for path in sorted(directory.glob("hookify.*.local.md"))[:64]:
        if path.is_file() and path.resolve() == path:
            candidates.append(path)
    if not candidates:
        return []
    names = [path.relative_to(root).as_posix() for path in candidates]
    ignored = git(root, "check-ignore", "-z", "--stdin",
                  data=("\0".join(names) + "\0").encode())
    if ignored.returncode not in (0, 1):
        return []
    allowed = set(ignored.stdout.decode("utf-8").split("\0"))
    rules = []
    for path, name in zip(candidates, names):
        if name not in allowed:
            continue
        try:
            rules.append((name, read_rule(path), None))
        except (OSError, ValueError, re.error) as error:
            rules.append((name, None, str(error)))
    return rules


def read_rule(path):
    with path.open("rb") as handle:
        data = handle.read(MAX_RULE + 1)
    if len(data) > MAX_RULE:
        raise ValueError("rule exceeds the 32 KiB limit")
    return parse_rule(data.decode("utf-8"))


def patch_records(patch):
    records = []
    for line in patch.splitlines():
        header = PATCH_HEADER.match(line)
        if header:
            if header[1] == "Move to" and records:
                records[-1]["paths"].append(header[2])
            else:
                records.append({"paths": [header[2]], "new_text": [], "old_text": []})
        elif records and line.startswith(("+", "-")):
            key = "new_text" if line[0] == "+" else "old_text"
            records[-1][key].append(line[1:])
    return [{"file_path": path, "new_text": "\n".join(row["new_text"]),
             "old_text": "\n".join(row["old_text"])} for row in records for path in row["paths"]]


def fields(event, payload):
    tool = payload.get("tool_name", "")
    source = payload.get("tool_input") or {}
    source = source if isinstance(source, dict) else {}
    command = source.get("command", "")
    base = {**payload, **source}
    if event == "UserPromptSubmit":
        prompt = payload.get("prompt")
        return "prompt", [{**base, "user_prompt": prompt, "content": prompt}]
    if event == "Stop":
        return "stop", [{**base, "content": payload.get("last_assistant_message")}]
    if tool == "apply_patch" and isinstance(command, str):
        return "file", [{**base, **row, "content": row["new_text"]} for row in patch_records(command)]
    if tool in {"Edit", "Write", "MultiEdit"}:
        if tool == "MultiEdit" and isinstance(source.get("edits"), list):
            return "file", [{**base, "new_text": edit.get("new_string"), "old_text": edit.get("old_string"),
                             "content": edit.get("new_string")} for edit in source["edits"] if isinstance(edit, dict)]
        text = source.get("new_text", source.get("new_string", source.get("content")))
        return "file", [{**base, "new_text": text, "old_text": source.get("old_text", source.get("old_string")),
                         "content": text}]
    if tool in {"Bash", "exec_command", "shell_command"}:
        return "bash", [{**base, "content": command}]
    return "tool", [base]


def transcript_tail(payload):
    path = payload.get("transcript_path")
    if not isinstance(path, str) or not Path(path).is_absolute():
        return None
    try:
        with open(path, "rb") as handle:
            handle.seek(max(0, handle.seek(0, 2) - MAX_TRANSCRIPT))
            return handle.read(MAX_TRANSCRIPT).decode("utf-8", errors="replace")
    except OSError:
        return None


def matches(operator, pattern, value):
    if not isinstance(value, str):
        return False
    if operator == "regex_match":
        return bool(pattern.search(value))
    if operator == "not_regex_match":
        return not pattern.search(value)
    if operator == "contains":
        return pattern in value
    if operator == "not_contains":
        return pattern not in value
    if operator == "equals":
        return pattern == value
    if operator == "starts_with":
        return value.startswith(pattern)
    return value.endswith(pattern)


def evaluate(payload, rules):
    event = payload.get("hook_event_name")
    if event not in {"PreToolUse", "PostToolUse", "UserPromptSubmit", "Stop"}:
        return {}
    category, rows = fields(event, payload)
    phase = "post" if event == "PostToolUse" else "pre"
    hits = []
    transcript = None
    read_transcript = False
    for rule in rules:
        if not rule.enabled or rule.event not in (category, "all") or rule.phase != phase:
            continue
        if rule.tool_matcher not in {"", "*"} and payload.get("tool_name") not in rule.tool_matcher.split("|"):
            continue
        if event == "Stop" and rule.action == "block" and payload.get("stop_hook_active"):
            continue
        if any(field == "transcript" for field, _, _ in rule.conditions) and not read_transcript:
            transcript = transcript_tail(payload)
            read_transcript = True
        if any(all(matches(op, pattern, transcript if key == "transcript" else row.get(key))
                   for key, op, pattern in rule.conditions) for row in rows):
            hits.append(rule)
    if not hits:
        return {}
    hits.sort(key=lambda rule: rule.action != "block")
    message = "\n\n".join(f"[Hookify: {rule.name}]\n{rule.message}" for rule in hits)[:4096]
    blocking = any(rule.action == "block" for rule in hits)
    if blocking and event == "PreToolUse":
        return {"hookSpecificOutput": {"hookEventName": event, "permissionDecision": "deny",
                                       "permissionDecisionReason": message}}
    if blocking:
        return {"decision": "block", "reason": message}
    if event == "Stop":
        return {"systemMessage": message}
    return {"hookSpecificOutput": {"hookEventName": event, "additionalContext": message}}


def main():
    parser = argparse.ArgumentParser(description="Check Codex Hookify rules")
    commands = parser.add_subparsers(dest="command")
    listing = commands.add_parser("list")
    listing.add_argument("--cwd", default=".")
    validation = commands.add_parser("validate")
    validation.add_argument("file", type=Path)
    args = parser.parse_args()
    if args.command == "validate":
        print(json.dumps(read_rule(args.file).name))
        return
    if args.command == "list":
        print(json.dumps([{"file": name, "enabled": rule.enabled if rule else None, "error": error}
                          for name, rule, error in local_rules(args.cwd)]))
        return
    try:
        payload = json.load(sys.stdin)
        entries = local_rules(payload["cwd"])
        for name, _, error in entries:
            if error:
                print(f"Hookify skipped {name}: {error}", file=sys.stderr)
        print(json.dumps(evaluate(payload, [rule for _, rule, _ in entries if rule])))
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError) as error:
        print(f"Hookify: {type(error).__name__}", file=sys.stderr)
        print("{}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, re.error, subprocess.SubprocessError) as error:
        sys.exit(str(error))

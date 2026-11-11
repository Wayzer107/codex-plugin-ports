"""Codex Stop hook that reminds users when their project memory bank is stale."""

import json
import os
import stat
import subprocess
import sys
from pathlib import Path


EXCLUDED_DIRS = {
    ".git",
    ".claude",
    ".cache",
    ".next",
    "build",
    "dist",
    "memory-bank",
    "node_modules",
}
MAX_REPORTED_FILES = 5


def project_root(cwd):
    """Use the Git root when available; otherwise use the hook's working directory."""
    candidate = Path(cwd or os.getcwd()).expanduser()
    try:
        candidate = candidate.resolve(strict=True)
    except OSError:
        return Path.cwd().resolve()
    if not candidate.is_dir():
        candidate = candidate.parent

    try:
        result = subprocess.run(
            ["git", "-C", str(candidate), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            root = Path(result.stdout.strip()).resolve(strict=True)
            if root.is_dir():
                return root
    except (OSError, subprocess.SubprocessError):
        pass
    return candidate


def walk_markdown_mtimes(directory):
    """Yield mtimes for regular Markdown files, without following symlinks."""
    for current, dirnames, filenames in os.walk(directory, followlinks=False):
        current_path = Path(current)
        dirnames[:] = sorted(
            name
            for name in dirnames
            if not (current_path / name).is_symlink()
        )
        for filename in filenames:
            if not filename.endswith(".md"):
                continue
            path = current_path / filename
            try:
                info = path.stat(follow_symlinks=False)
            except OSError:
                continue
            if stat.S_ISREG(info.st_mode):
                yield info.st_mtime


def latest_memory_bank_mtime(root):
    directory = root / "memory-bank"
    if not directory.is_dir() or directory.is_symlink():
        return None
    return max(walk_markdown_mtimes(directory), default=None)


def newer_project_files(root, memory_bank_mtime):
    found = []
    for current, dirnames, filenames in os.walk(root, topdown=True, followlinks=False):
        current_path = Path(current)
        dirnames[:] = sorted(
            name
            for name in dirnames
            if name not in EXCLUDED_DIRS and not (current_path / name).is_symlink()
        )
        for filename in filenames:
            path = current_path / filename
            try:
                info = path.stat(follow_symlinks=False)
            except OSError:
                continue
            if stat.S_ISREG(info.st_mode) and info.st_mtime > memory_bank_mtime:
                try:
                    found.append(path.relative_to(root).as_posix())
                except ValueError:
                    continue
                if len(found) == MAX_REPORTED_FILES:
                    return found
    return found


def evaluate(payload):
    if payload.get("hook_event_name") not in (None, "Stop"):
        return {}
    if payload.get("stop_hook_active") is True:
        return {}

    root = project_root(payload.get("cwd"))
    memory_bank_mtime = latest_memory_bank_mtime(root)
    if memory_bank_mtime is None:
        return {}

    files = newer_project_files(root, memory_bank_mtime)
    if not files:
        return {}

    files_list = ", ".join(files)
    reason = (
        "Before finishing, update the memory bank to capture recent work.\n\n"
        f"Files changed since the last memory bank update: {files_list}\n\n"
        "Please update:\n"
        "- memory-bank/activeContext.md: current focus, recent changes, and next steps\n"
        "- memory-bank/progress.md: what was completed, what remains, and known issues\n\n"
        "Once updated, you can stop."
    )
    return {"decision": "block", "reason": reason}


def main():
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("hook input must be a JSON object")
        result = evaluate(payload)
    except (OSError, ValueError, TypeError, subprocess.SubprocessError) as error:
        print(f"Memory Bank hook skipped: {type(error).__name__}", file=sys.stderr)
        result = {}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

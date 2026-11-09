import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

RUN = pathlib.Path(__file__).resolve().parents[1] / "plugins/hookify/hooks/run.py"


class HookifyTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="hookify-test-")
        self.addCleanup(directory.cleanup)
        self.root = pathlib.Path(directory.name)
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        (self.root / ".codex").mkdir()
        (self.root / "nested").mkdir()
        (self.root / ".git/info/exclude").write_text("/.codex/hookify.*.local.md\n", encoding="utf-8")

    def rule(self, name, fields):
        path = self.root / ".codex" / f"hookify.{name}.local.md"
        path.write_text(f"---\nname: {name}\n{fields}\n---\nReview this action.\n", encoding="utf-8")
        return path

    def hook(self, event, **fields):
        data = {"cwd": str(self.root / "nested"), "hook_event_name": event, **fields}
        result = subprocess.run([sys.executable, str(RUN)], input=json.dumps(data),
                                text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_shell_and_post_result_are_distinct(self):
        self.rule("pre", r"event: bash" + "\naction: block\npattern: marker---one")
        self.rule("post", "event: bash\nphase: post\naction: block\npattern: marker---one")
        call = {"tool_name": "Bash", "tool_input": {"command": "echo MARKER---ONE"}}
        self.assertEqual(self.hook("PreToolUse", **call)["hookSpecificOutput"]["permissionDecision"], "deny")
        self.assertIn("[Hookify: post]", self.hook("PostToolUse", **call)["reason"])
        self.assertEqual(self.hook("PreToolUse", tool_name="other", tool_input=call["tool_input"]), {})

    def test_patch_conditions_match_the_same_file(self):
        self.rule("file", r"""event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.ts$
  - field: new_text
    operator: contains
    pattern: console.log(""")
        patch = "*** Begin Patch\n*** Add File: a.ts\n+export {};\n*** Add File: b.js\n+console.log(1);\n*** End Patch"
        self.assertEqual(self.hook("PreToolUse", tool_name="apply_patch", tool_input={"command": patch}), {})
        matched = self.hook("PreToolUse", tool_name="apply_patch", tool_input={"command": patch.replace("b.js", "b.ts")})
        self.assertIn("[Hookify: file]", matched["hookSpecificOutput"]["additionalContext"])

    def test_prompt_stop_and_continuation_guard(self):
        self.rule("prompt", "event: prompt\naction: block\npattern: ^test fixture$")
        self.rule("stop", "event: stop\naction: block\npattern: incomplete")
        self.assertEqual(self.hook("UserPromptSubmit", prompt="test fixture")["decision"], "block")
        self.assertEqual(self.hook("Stop", last_assistant_message="incomplete")["decision"], "block")
        self.assertEqual(self.hook("Stop", last_assistant_message="incomplete", stop_hook_active=True), {})

    def test_tracked_disabled_and_invalid_rules_do_not_fire(self):
        tracked = self.rule("tracked", "event: prompt\naction: block\npattern: sample")
        subprocess.run(["git", "-C", str(self.root), "add", "-f", str(tracked)], check=True)
        self.rule("disabled", "event: prompt\nenabled: false\npattern: sample")
        self.rule("invalid", "event: prompt\npattern: [")
        self.assertEqual(self.hook("UserPromptSubmit", prompt="sample"), {})

    def test_unavailable_transcript_cannot_match_a_negative_condition(self):
        self.rule("tests", """event: stop
action: block
conditions:
  - field: transcript
    operator: not_regex_match
    pattern: cargo test|pytest""")
        path = self.root / "transcript.jsonl"
        self.assertEqual(self.hook("Stop", transcript_path=str(path)), {})
        path.write_text("Some output", encoding="utf-8")
        self.assertEqual(self.hook("Stop", transcript_path=str(path))["decision"], "block")
        path.write_text("Ran pytest", encoding="utf-8")
        self.assertEqual(self.hook("Stop", transcript_path=str(path)), {})


if __name__ == "__main__":
    unittest.main()

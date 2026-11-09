# Rule syntax

Place rules at `.codex/hookify.<name>.local.md` in the Git root. Git must ignore them and they must be untracked. The hook uses a small Markdown frontmatter parser. Write simple key-value pairs and indented condition lists. The body is the message Codex receives.

~~~markdown
---
name: warn-console-log
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: .tsx?$
  - field: new_text
    operator: contains
    pattern: console.log(
---

Check whether this debug logging is intentional.
~~~

A top-level `pattern` is shorthand for one `regex_match` condition. All conditions must match the same input record. Patch rules see separate records for each file in the patch.

| Event | Fields and timing |
| --- | --- |
| `bash` | `command` from a Codex shell call |
| `file` | `file_path`, `new_text` and `old_text` from a supported file-edit call. Edits performed by shell commands use `bash`. |
| `prompt` | `prompt` or `user_prompt` before the prompt is submitted |
| `stop` | `last_assistant_message` and, when explicitly referenced, the last 256 KiB of the transcript file |
| `all` | Each supported hook category. Specify the fields needed for the intended event. |

Tool rules run before the call by default. Use `phase: post` for post-tool feedback and `tool_matcher: Bash|apply_patch` to restrict the tool names. `block` on a pre-tool event denies the call. On a post-tool event it replaces the result with feedback after the tool has run. A prompt block rejects that prompt. A stop block asks Codex to continue once.

Operators are `regex_match`, `not_regex_match`, `contains`, `not_contains`, `equals`, `starts_with` and `ends_with`. Regex matching is case-insensitive and uses Python syntax. Literal operators are case-sensitive. An unavailable field does not match a negative condition. Transcript text is a heuristic for what the agent did, so use test results as the evidence for an actual test pass.

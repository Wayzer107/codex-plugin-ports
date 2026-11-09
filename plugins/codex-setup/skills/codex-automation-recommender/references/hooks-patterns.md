# Hooks

Codex reads `hooks.json` or inline hooks from active configuration layers. Use `.codex/hooks.json` for a trusted repository or `~/.codex/hooks.json` for personal scope. Use `/hooks` in the CLI to review sources and trust the intended definitions. A new or changed definition requires review.

| Evidence | Pattern |
| --- | --- |
| Fast lint or formatting check with a precise file scope | `PostToolUse` on the relevant edit tool |
| Slow tests or full type checking | Existing explicit command or CI |
| Repeated writes through a particular tool to a protected path | `PreToolUse` guard for the known tool and input, backed by repository enforcement for other paths |
| Repeated task finishing without a narrow verification step | Consider a `Stop` hook after checking the installed client's event and response semantics |

For `PreToolUse` and `PostToolUse`, Codex matches shell commands as `Bash` even when the user's shell is PowerShell. Patch tools can match `apply_patch`; that matcher will miss edits performed through the shell or other tools. Hook commands receive event JSON on stdin. Use the documented event-specific input and output shape, and confirm it with a scratch repository on the target operating system. Give a hook a finite timeout and avoid writes outside its intended scope. Treat hooks as workflow checks with limited tool coverage.

[Codex hooks documentation](https://learn.chatgpt.com/docs/hooks)

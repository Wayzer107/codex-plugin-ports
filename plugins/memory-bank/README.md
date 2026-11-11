# Memory Bank for Codex

The Memory Bank plugin preserves project context in Markdown files under `memory-bank/`.

| Component | Use it for |
| --- | --- |
| `$memory-bank:memory-bank` | Initializing, reading, and maintaining the project's six core context files |
| Codex `Stop` hook | Reminding you to update `activeContext.md` and `progress.md` when project files are newer than the memory bank |

Install from the registered marketplace:

~~~powershell
codex plugin marketplace upgrade codex-plugin-ports
codex plugin add 'memory-bank@codex-plugin-ports'
~~~

Start a new Codex conversation in the project. Use `$memory-bank:memory-bank` or ask Codex to initialize, read, or update the memory bank. When `memory-bank/` exists, the skill reads the six core files at the start of work. It does not create the directory unless asked.

The Stop hook is quiet when there is no `memory-bank/` directory, when it has no Markdown files, or when no newer project files are found. It uses the Git root when available, falling back to Codex's working directory. It ignores `.git`, `.claude`, `.cache`, `.next`, `build`, `dist`, `memory-bank`, and `node_modules` directories. The hook reports at most five newer paths and skips a repeated block when Codex marks the stop as an active continuation.

The hook requires Python 3.10 or newer on the same computer as Codex. It reads file modification times only and makes no network requests. The skill reads memory bank Markdown and relevant project files to maintain context.

## Upstream and changes

Ported from the Claude Code Memory Bank plugin, version 0.1.0, by cjgl23 under the [Apache License 2.0](LICENSE). This port keeps the original six-file workflow and translates the stop reminder to Codex's `Stop` hook format. The hook is implemented in Python so it can run on Windows and POSIX systems.

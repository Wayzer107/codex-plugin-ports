# AGENTS.md templates

Use only sections supported by the repository. Replace placeholders with verified details and keep existing headings when updating a file.

## Project root

```markdown
# <Project name>

## Commands

- From <directory>, run `<command>` to <purpose>.

## Architecture

- `<path>/` owns <responsibility>.

## Gotchas

- <Non-obvious repository invariant and how to verify it>.
```

## Package or module

```markdown
# <Package name>

## Testing

- From `<package path>`, run `<command>`. <Explain any test scope that differs from the root>.

## Conventions

- <Package-only rule and the relevant entry point or fixture>.
```

For a monorepo, keep common commands, package boundaries, and shared constraints at the root. Put package-specific commands, fixtures, and exceptions in the applicable subtree. Document environment variable names and setup sources without recording values.

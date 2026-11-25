---
name: dart-best-practices
description: "Use when writing or reviewing Dart code. Covers Dart-specific idioms, tooling, project layout, and testing conventions. For universal principles (SOLID, TDD, clean architecture) see the relevant category skills.\n"
---

## Overview

Dart is an ahead-of-time compiled, null-safe language optimized for UI development. Its sound null safety, async/await model, and hot reload (via Flutter) make it uniquely productive for cross-platform application development.

## Idioms & Conventions

- **Null safety** -- All types are non-nullable by default. Use `?` suffix for nullable types. Prefer `if-case` or null-aware operators (`?.`, `??`, `??=`) over explicit null checks.
- **async/await** -- Use `Future<T>` for single async values, `Stream<T>` for async sequences. Mark functions `async` and `await` at call sites. Use `Future.wait` for parallel execution.
- **Mixins** -- Use `mixin` for sharing behavior across unrelated class hierarchies. Prefer over multiple inheritance patterns.
- **Extension methods** -- Add functionality to existing types: `extension StringX on String { ... }`. Use for utility methods that feel native.
- **Cascades** -- Use `..` for fluent method chaining on the same object (especially for builders and configuration).
- **Pattern matching** -- Dart 3 supports destructuring, switch expressions, and sealed class exhaustiveness.
- **Naming** -- `lowerCamelCase` for variables/functions, `UpperCamelCase` for types, `lowercase_with_underscores` for files and libraries. Prefix private members with `_`.

## Tooling

| Tool | Purpose |
|------|---------|
| `dart analyze` | Static analysis (built-in) |
| `dart format` | Canonical formatter (non-negotiable) |
| `dart fix` | Automated code migrations |
| `pub` / `dart pub` | Package manager (pub.dev) |
| `analysis_options.yaml` | Lint rule configuration |
| DCM (Dart Code Metrics) | Advanced static analysis |

## Project Structure

```
lib/                    # Source code
lib/src/                # Private implementation (not exported)
lib/package_name.dart   # Public API barrel file
test/                   # Test files
bin/                    # CLI entrypoints (for command-line apps)
pubspec.yaml            # Package manifest and dependencies
analysis_options.yaml   # Linter configuration
```

Export public API through barrel files. Keep `lib/src/` private; only `lib/*.dart` files are importable by consumers.

## Testing

- **`package:test`** is the standard framework. Use `test()`, `group()`, and `expect()` with matchers.
- **`package:mockito`** with `@GenerateMocks` for type-safe mock generation via code gen.
- Use `setUp` / `tearDown` for fixture management.
- Async tests return `Future<void>`; the runner awaits them automatically.
- **`package:fake_async`** for controlling time in tests with `FakeAsync`.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Unawaited futures | Always `await` futures or use `unawaited()` to signal intentional fire-and-forget |
| Late initialization errors | Minimize `late`; prefer nullable with null checks or constructor initialization |
| Large barrel files | Export only public API; avoid re-exporting internal implementation |
| Mutable state in const constructors | Ensure `const` classes have only `final` fields |
| Import cycles | Structure code in layers; use dependency injection to break circular imports |

## Related Framework Skills

| Framework | Official Skill? | Link / Status |
|-----------|----------------|---------------|
| Flutter | Partial | Community skill only; no comprehensive official skill |
| Dart server (shelf) | No | Gap -- no official skill |
| Serverpod | No | Gap -- no official skill |
| Dart Frog | No | Gap -- no official skill |

## Attribution
**Original** -- Datatide, MIT licensed.

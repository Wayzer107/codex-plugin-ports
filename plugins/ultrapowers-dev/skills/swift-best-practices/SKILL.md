---
name: swift-best-practices
description: "Use when writing or reviewing Swift code. Covers Swift-specific idioms, tooling, project layout, and testing conventions. For universal principles (SOLID, TDD, clean architecture) see the relevant category skills.\n"
---

## Overview

Swift combines safety (optionals, value types, memory management) with performance and expressiveness. Its protocol-oriented design, structured concurrency with actors, and first-class support for Apple platforms make it distinctive among modern languages.

## Idioms & Conventions

- **Optionals** -- Use `guard let` for early exit, `if let` for conditional binding. Avoid force-unwrapping (`!`) except in tests or `IBOutlet` declarations.
- **Value types** -- Prefer `struct` over `class` by default. Use `class` only when you need reference semantics, inheritance, or `deinit`.
- **Protocols** -- Favor protocol-oriented design over class hierarchies. Use protocol extensions for default implementations.
- **Actors** -- Use `actor` for thread-safe mutable state. Mark async entry points with `async` and use `await` at call sites.
- **Structured concurrency** -- Use `async let` for parallel work, `TaskGroup` for dynamic fan-out. Avoid unstructured `Task { }` when possible.
- **Result builders** -- Understand `@ViewBuilder` and `@resultBuilder` for DSL-style APIs (SwiftUI).
- **Naming** -- Follow the [Swift API Design Guidelines](https://swift.org/documentation/api-design-guidelines/): clarity at the point of use, fluent usage, factory methods start with `make`.

## Tooling

| Tool | Purpose |
|------|---------|
| Swift Package Manager (SPM) | Dependency management and builds |
| SwiftLint | Style linting (Realm) |
| SwiftFormat | Opinionated code formatter |
| Xcode Instruments | Performance profiling |
| swift-testing | New testing framework (Swift 5.10+) |

## Project Structure

```
Sources/PackageName/      # Source code (SPM)
Tests/PackageNameTests/   # Tests (SPM)
Package.swift             # SPM manifest
```

For Xcode projects, follow the group-matches-folder convention. SPM packages use the `Sources/` / `Tests/` layout.

## Testing

- **XCTest** is the established framework. Use `XCTestCase` subclasses with `test` prefix methods.
- **swift-testing** (new) uses `@Test` attribute and `#expect` macro -- preferred for new projects.
- Use `async` test methods for testing concurrent code. Use `XCTestExpectation` or `withCheckedContinuation` for callback-based APIs.
- Mock protocols, not classes. Inject dependencies via initializers.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Retain cycles in closures | Use `[weak self]` or `[unowned self]` capture lists |
| Force-unwrapping crashes | Use `guard let` / `if let`; reserve `!` for controlled scenarios |
| Main actor blocking | Offload heavy work to detached tasks or background actors |
| Large value type copies | Use copy-on-write semantics or `class` for large shared state |
| Sendable conformance gaps | Audit types crossing actor boundaries; mark as `@Sendable` or `Sendable` |

## Related Framework Skills

| Framework | Official Skill? | Link / Status |
|-----------|----------------|---------------|
| SwiftUI | Yes | [AvdLee/SwiftUI-Agent-Skill](https://github.com/AvdLee/SwiftUI-Agent-Skill) (2.2K stars) |
| UIKit | No | Gap -- no official skill |
| Vapor (server-side) | No | Gap -- no official skill |
| Combine | No | Gap -- no official skill |

## Attribution
**Original** -- Datatide, MIT licensed.

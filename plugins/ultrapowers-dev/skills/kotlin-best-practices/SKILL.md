---
name: kotlin-best-practices
description: "Use when writing or reviewing Kotlin code. Covers Kotlin-specific idioms, tooling, project layout, and testing conventions. For universal principles (SOLID, TDD, clean architecture) see the relevant category skills.\n"
---

## Overview

Kotlin combines null safety, coroutines, and concise syntax with full JVM interoperability. Its expressive type system (sealed classes, data classes, delegation) reduces boilerplate while maintaining Java ecosystem compatibility.

## Idioms & Conventions

- **Null safety** -- Use nullable types (`String?`) explicitly. Prefer safe calls (`?.`), Elvis (`?:`) and `let` over `!!`. Reserve `!!` for test code only.
- **Data classes** -- Use for value objects; they auto-generate `equals`, `hashCode`, `copy`, and destructuring.
- **Sealed classes/interfaces** -- Model closed hierarchies for exhaustive `when` expressions. Compiler enforces all branches.
- **Coroutines** -- Use `suspend` functions for async work. Launch coroutines in a `CoroutineScope`; use `structured concurrency` to manage lifecycles.
- **Extension functions** -- Add behavior to existing types without inheritance. Keep them discoverable by placing in relevant files.
- **Scope functions** -- Use `let` for null transforms, `apply` for object configuration, `also` for side effects, `run` for scoped computation, `with` for grouping calls.
- **Naming** -- PascalCase classes, camelCase functions/properties, UPPER_SNAKE constants. File names match the primary class or describe the contents.

## Tooling

| Tool | Purpose |
|------|---------|
| Gradle (Kotlin DSL) | Build system (`build.gradle.kts`) |
| ktlint | Linter/formatter (official Kotlin style) |
| detekt | Static analysis and code smell detection |
| Kover | Code coverage |
| K2 compiler | Next-gen compiler (faster, smarter) |

## Project Structure

```
src/main/kotlin/com/example/   # Source code
src/main/resources/             # Config and assets
src/test/kotlin/com/example/   # Tests mirror source packages
build.gradle.kts                # Build definition (Kotlin DSL)
```

Follows Gradle/Maven conventions. Multiplatform projects add `commonMain`, `jvmMain`, `iosMain`, etc.

## Testing

- **JUnit 5** with Kotlin extensions. Use backtick-quoted test names for readability: `` `should return empty list when no items` ``.
- **MockK** is the idiomatic Kotlin mocking library (supports coroutines, extension functions).
- **Kotest** offers property-based testing and a Kotlin-native DSL.
- Use `runTest` from `kotlinx-coroutines-test` for testing suspend functions with virtual time.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Coroutine leak | Always use structured concurrency; cancel parent scope on cleanup |
| `data class` inheritance | Data classes cannot be open; use sealed hierarchies instead |
| Platform type nullability | Java interop types are platform (`T!`); annotate with `@Nullable`/`@NotNull` at the boundary |
| Overusing scope functions | Limit nesting; if more than two chained scope functions, refactor |
| `GlobalScope` usage | Avoid `GlobalScope`; inject a `CoroutineScope` tied to lifecycle |

## Related Framework Skills

| Framework | Official Skill? | Link / Status |
|-----------|----------------|---------------|
| Spring Boot (Kotlin) | Yes | [github/awesome-copilot](https://github.com/github/awesome-copilot) |
| Ktor | No | Gap -- no official skill |
| Jetpack Compose | No | Gap -- no official skill |
| Kotlin Multiplatform | No | Gap -- no official skill |

## Attribution
**Original** -- Datatide, MIT licensed.

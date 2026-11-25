---
name: java-best-practices
description: "Use when writing or reviewing Java code. Covers Java-specific idioms, tooling, project layout, and testing conventions. For universal principles (SOLID, TDD, clean architecture) see the relevant category skills.\n"
---

## Overview

Java emphasizes strong typing, backward compatibility, and a mature ecosystem. Modern Java (17+) brings records, sealed classes, pattern matching, and virtual threads, making it significantly more concise than legacy idioms.

## Idioms & Conventions

- **Records** -- Use `record` for immutable data carriers instead of boilerplate POJOs.
- **Sealed classes** -- Model closed type hierarchies with `sealed` + `permits` for exhaustive pattern matching.
- **Optional** -- Return `Optional<T>` instead of null for values that may be absent. Never use `Optional` as a field or parameter type.
- **Streams** -- Prefer streams for collection transformations but avoid deeply nested chains. Use method references where readable.
- **Try-with-resources** -- Always use for `AutoCloseable` resources.
- **Immutability** -- Favor `final` fields, `List.of()`, `Map.of()` for unmodifiable collections.
- **Naming** -- PascalCase classes, camelCase methods/fields, UPPER_SNAKE constants. Package names are all lowercase.

## Tooling

| Tool | Purpose |
|------|---------|
| Maven / Gradle | Build and dependency management |
| SpotBugs | Bug pattern detection |
| Checkstyle | Style enforcement |
| Error Prone | Compile-time bug catching (Google) |
| JaCoCo | Code coverage |
| jlink / jpackage | Custom runtime images and packaging |

## Project Structure

```
src/main/java/com/example/   # Source code
src/main/resources/           # Config, templates
src/test/java/com/example/   # Tests mirror source packages
pom.xml / build.gradle        # Build definition
```

Follow the Maven Standard Directory Layout. One public class per file matching the filename.

## Testing

- **JUnit 5** is the standard. Use `@Nested` for grouping, `@ParameterizedTest` for data-driven tests.
- **Mockito** for mocking; prefer constructor injection to make classes testable.
- **AssertJ** for fluent, readable assertions.
- Integration tests go in `src/test/java` with an `IT` suffix or a separate source set.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| `NullPointerException` | Use `Optional`, `@Nullable` annotations, and null checks at boundaries |
| Mutable date/time | Use `java.time` API (immutable); never `java.util.Date` |
| Checked exception overuse | Reserve for recoverable conditions; use unchecked for programming errors |
| `equals`/`hashCode` mismatch | Always override both together; use records or IDE generation |
| Thread-unsafe collections | Use `ConcurrentHashMap`, `CopyOnWriteArrayList`, or synchronized wrappers |

## Related Framework Skills

| Framework | Official Skill? | Link / Status |
|-----------|----------------|---------------|
| Spring Boot | Yes | [github/awesome-copilot](https://github.com/github/awesome-copilot) |
| Quarkus | No | Gap -- no official skill |
| Micronaut | No | Gap -- no official skill |
| Jakarta EE | No | Gap -- no official skill |

## Attribution
**Original** -- Datatide, MIT licensed.

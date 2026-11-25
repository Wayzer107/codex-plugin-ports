---
name: csharp-best-practices
description: "Use when writing or reviewing C# code. Covers C#-specific idioms, tooling, project layout, and testing conventions. For universal principles (SOLID, TDD, clean architecture) see the relevant category skills.\n"
---

## Overview

C# combines the rigor of static typing with modern language features like async/await, LINQ, pattern matching, and nullable reference types. The .NET ecosystem provides a unified platform for web, desktop, mobile, and cloud applications.

## Idioms & Conventions

- **Nullable reference types (NRTs)** -- Enable `<Nullable>enable</Nullable>` in all projects. Annotate nullability explicitly; treat warnings as errors.
- **async/await** -- Use `async Task` (not `async void` except for event handlers). Prefer `ValueTask` for hot paths that often complete synchronously.
- **LINQ** -- Use for declarative collection queries. Prefer method syntax for complex chains; query syntax for joins.
- **Records** -- Use `record` for immutable value objects with structural equality. Use `record struct` for stack-allocated value types.
- **Pattern matching** -- Use `switch` expressions with property/type/relational patterns for clean branching.
- **Naming** -- PascalCase for public members and types. Private fields use `_camelCase`. Interfaces prefix with `I`.
- **Dependency injection** -- Use constructor injection with the built-in DI container. Register services in `Program.cs` or extension methods.

## Tooling

| Tool | Purpose |
|------|---------|
| `dotnet` CLI | Build, run, test, publish |
| Roslyn analyzers | In-compiler static analysis |
| `.editorconfig` | Code style enforcement (team-shared) |
| `dotnet format` | Auto-formatter aligned with editorconfig |
| NuGet | Package management |
| BenchmarkDotNet | Micro-benchmarking |

## Project Structure

```
src/ProjectName/           # Source projects
src/ProjectName.Api/       # Web API project
tests/ProjectName.Tests/   # Test projects
ProjectName.sln            # Solution file
Directory.Build.props      # Shared MSBuild properties
```

Use solution files to group projects. Shared settings go in `Directory.Build.props` at the repo root.

## Testing

- **xUnit** is the most common framework. Use `[Fact]` for single tests, `[Theory]` with `[InlineData]` for parameterized tests.
- **NSubstitute** or **Moq** for mocking interfaces.
- **FluentAssertions** for readable assertion chains.
- Test projects reference source projects, never the reverse.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| `async void` | Always return `Task`; `async void` swallows exceptions |
| Deadlocks with `.Result` / `.Wait()` | Use `await` all the way up; never block on async code |
| LINQ deferred execution | Materialize with `.ToList()` when you need to iterate multiple times |
| Mutable structs | Make structs `readonly`; use `record struct` for value semantics |
| Missing `ConfigureAwait(false)` in libraries | Use it in library code to avoid capturing `SynchronizationContext` |

## Related Framework Skills

| Framework | Official Skill? | Link / Status |
|-----------|----------------|---------------|
| ASP.NET Core | Yes | [github/awesome-copilot](https://github.com/github/awesome-copilot) |
| Blazor | Partial | Community skills exist; no comprehensive official skill |
| EF Core | Yes | [github/awesome-copilot](https://github.com/github/awesome-copilot) |
| MAUI | No | Gap -- no official skill |

## Attribution
**Original** -- Datatide, MIT licensed.

---
name: go-best-practices
description: "Use when writing or reviewing Go code. Covers Go-specific idioms, tooling, project layout, and testing conventions. For universal principles (SOLID, TDD, clean architecture) see the relevant category skills.\n"
---

## Overview

Go favors simplicity, explicit error handling, and composition over inheritance. Its concurrency primitives (goroutines and channels) and single-binary compilation model make it uniquely suited for networked services and CLI tools.

## Idioms & Conventions

- **Error handling** -- Return `error` as the last value; never panic in library code. Wrap errors with `fmt.Errorf("context: %w", err)` for stack context.
- **Interfaces** -- Keep interfaces small (1-3 methods). Define them where they are *consumed*, not where they are implemented.
- **Defer** -- Use `defer` for cleanup (closing files, unlocking mutexes). Defers execute LIFO.
- **Goroutines & channels** -- Prefer channels for coordination, `sync.WaitGroup` for fan-out. Always ensure goroutines can exit (use `context.Context` for cancellation).
- **Zero values are useful** -- Design structs so their zero value is valid (e.g., `sync.Mutex`, `bytes.Buffer`).
- **Accept interfaces, return structs** -- Functions should take narrow interfaces and return concrete types.
- **Naming** -- Short receiver names (`s`, not `self`). Exported names are PascalCase; unexported are camelCase. Acronyms stay uppercase (`HTTPClient`, not `HttpClient`).

## Tooling

| Tool | Purpose |
|------|---------|
| `go fmt` / `gofmt` | Canonical formatter (non-negotiable) |
| `go vet` | Static analysis for common mistakes |
| `golangci-lint` | Meta-linter aggregating 50+ linters |
| `staticcheck` | Advanced static analysis |
| `govulncheck` | Known vulnerability scanning |

## Project Structure

```
cmd/appname/main.go   # Entrypoints
internal/             # Private packages (compiler-enforced)
pkg/                  # Public library code (optional, use sparingly)
go.mod / go.sum       # Module definition
```

Use `internal/` to prevent external imports. Flat package structures are preferred over deep nesting.

## Testing

- Test files live alongside source: `foo.go` / `foo_test.go`.
- Table-driven tests are idiomatic -- use `[]struct{ name string; ... }` slices with `t.Run`.
- `testify` is popular but stdlib `testing` is sufficient for most cases.
- Use `t.Parallel()` for independent tests. Use `t.Helper()` in test helpers.
- Benchmarks use `func BenchmarkX(b *testing.B)` with `b.N` loop.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Goroutine leak | Always cancel contexts; use `errgroup` for managed fan-out |
| Nil pointer on interface | A nil concrete value wrapped in an interface is non-nil |
| Range variable capture | Go 1.22+ fixes loop variable capture; pre-1.22 copy the variable |
| Slice append mutation | Append may or may not allocate; copy if sharing backing arrays |
| `init()` side effects | Avoid `init()`; use explicit initialization functions |

## Related Framework Skills

| Framework | Official Skill? | Link / Status |
|-----------|----------------|---------------|
| Gin | No | Gap -- community web framework, no official skill |
| Echo | No | Gap -- no official skill |
| Fiber | No | Gap -- no official skill |
| gRPC-Go | No | Gap -- no official skill |

## Attribution
**Original** -- Datatide, MIT licensed.

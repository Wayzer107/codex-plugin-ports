---
name: c-cpp-best-practices
description: "Use when writing or reviewing C/C++ code. Covers memory management, RAII, smart pointers, const correctness, CMake, sanitizers, and common undefined behavior pitfalls."
---

# C/C++ Best Practices

C gives you full control; C++ gives you abstractions to manage that control safely. In both, every allocation must have an owner and every pointer must have a valid target.

## Memory Management

- **C: pair every `malloc` with `free`.** Use a single owner convention -- whoever allocates is responsible for freeing.
- **C++: RAII everywhere.** Acquire resources in constructors, release in destructors. Never call `new`/`delete` directly in application code.
- **Smart pointers (C++):** `std::unique_ptr` for sole ownership, `std::shared_ptr` only when ownership is genuinely shared. Avoid `std::shared_ptr` as a default.
- **Prefer stack allocation.** Heap-allocate only when lifetime must exceed the current scope or size is unknown at compile time.

## Const Correctness

- Mark parameters `const` unless mutation is intended: `void process(const std::string& input)`.
- Mark member functions `const` when they do not modify state.
- In C, use `const` pointers: `const char* str` (pointer to const data) vs `char* const ptr` (const pointer).

## Tooling

| Tool | Purpose |
|---|---|
| CMake | Build system -- use `target_*` commands, avoid global settings |
| `clang-tidy` | Static analysis -- enable `modernize-*`, `bugprone-*`, `cppcoreguidelines-*` |
| AddressSanitizer | Runtime detection of buffer overflows, use-after-free (`-fsanitize=address`) |
| Valgrind / `memcheck` | Memory leak detection, uninitialised reads |
| `clang-format` | Code formatting -- enforce in CI |

## Testing

- **Google Test** or **Catch2** for C++ unit tests. Integrate with CTest via CMake.
- Run tests under ASan and UBSan in CI to catch memory and undefined behavior bugs early.

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Buffer overflow (out-of-bounds write) | Use `std::vector`/`std::array` (C++), bounds-check in C, enable ASan |
| Dangling pointer / use-after-free | RAII + smart pointers; never return pointers to locals |
| Undefined behavior (signed overflow, null deref) | Enable `-fsanitize=undefined`, test with UBSan |
| Memory leaks | Valgrind in CI, RAII in C++, cleanup functions in C |
| Missing virtual destructor (C++) | Always declare `virtual ~Base() = default` for polymorphic base classes |
| Raw `new`/`delete` in modern C++ | Use `std::make_unique` / `std::make_shared` exclusively |

## Attribution
**Original** -- Datatide, MIT licensed.

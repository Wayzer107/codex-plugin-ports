---
name: ruby-best-practices
description: "Use when writing or reviewing Ruby code. Covers Ruby-specific idioms, tooling, project layout, and testing conventions. For universal principles (SOLID, TDD, clean architecture) see the relevant category skills.\n"
---

## Overview

Ruby prioritizes developer happiness and expressiveness. Its dynamic typing, powerful metaprogramming, and block-based iteration model enable highly readable DSLs and convention-over-configuration frameworks.

## Idioms & Conventions

- **Blocks, procs, lambdas** -- Use blocks for inline iteration and callbacks. Use `Proc.new` for flexible arity; `lambda` (or `->`) for strict arity and return behavior.
- **Duck typing** -- Rely on behavior (`respond_to?`) rather than class checks. Program to interfaces through convention.
- **Metaprogramming** -- Use `define_method`, `method_missing`, and `class_eval` judiciously. Always define `respond_to_missing?` alongside `method_missing`.
- **Enumerable** -- Leverage `map`, `select`, `reduce`, `flat_map` for collection transformations. Prefer functional style over manual loops.
- **Symbols vs strings** -- Use symbols for identifiers/keys (`:name`), strings for data. Symbols are immutable and interned.
- **Freeze strings** -- Add `# frozen_string_literal: true` to every file for performance and immutability.
- **Naming** -- `snake_case` for methods/variables, `PascalCase` for classes/modules, `UPPER_SNAKE` for constants. Predicate methods end with `?`, dangerous methods with `!`.

## Tooling

| Tool | Purpose |
|------|---------|
| Bundler | Dependency management (`Gemfile` / `Gemfile.lock`) |
| RuboCop | Linter and formatter (community style guide) |
| Sorbet | Gradual type checking (Stripe) |
| Ruby LSP | Editor integration and diagnostics |
| IRB / Pry | Interactive REPL and debugging |

## Project Structure

```
lib/gem_name/         # Source code
lib/gem_name.rb       # Main require entry point
spec/ or test/        # RSpec or Minitest files
bin/                  # CLI executables
Gemfile               # Dependencies
gem_name.gemspec      # Gem specification (for libraries)
```

Gems follow this convention. Applications (especially Rails) use the framework's prescribed layout.

## Testing

- **RSpec** is the dominant framework: `describe`, `context`, `it` blocks with `expect` syntax.
- **Minitest** is the stdlib alternative -- lighter, uses `assert_*` style.
- Use `let` / `let!` for lazy/eager fixtures in RSpec. Avoid `before(:all)` for mutable state.
- **FactoryBot** for test data generation; **WebMock** / **VCR** for HTTP stubbing.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| `method_missing` without `respond_to_missing?` | Always implement both together |
| Monkey patching core classes | Use Refinements instead of global patches |
| N+1 queries (in Rails context) | Use `includes` / `preload`; enforce with Bullet gem |
| Mutable default arguments | Use `nil` default with `||=` pattern inside method body |
| Thread safety | Ruby has a GIL (GVL) but shared mutable state is still unsafe; use `Mutex` or `Concurrent::` classes |

## Related Framework Skills

| Framework | Official Skill? | Link / Status |
|-----------|----------------|---------------|
| Ruby on Rails | No | Gap -- no official skill |
| Sinatra | No | Gap -- no official skill |
| Hanami | No | Gap -- no official skill |
| Sidekiq | No | Gap -- no official skill |

## Attribution
**Original** -- Datatide, MIT licensed.

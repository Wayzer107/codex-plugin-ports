---
name: php-best-practices
description: "Use when writing or reviewing PHP code. Covers PHP-specific idioms, tooling, project layout, and testing conventions. For universal principles (SOLID, TDD, clean architecture) see the relevant category skills.\n"
---

## Overview

Modern PHP (8.1+) is a typed, object-oriented language with enums, fibers, readonly properties, and intersection types. It has shed its legacy reputation through strict typing, PSR standards, and a mature package ecosystem via Composer.

## Idioms & Conventions

- **Type declarations** -- Use strict types everywhere: `declare(strict_types=1);` at the top of every file. Type all parameters, return values, and properties.
- **Enums** -- Use backed enums (`enum Status: string`) instead of class constants for finite value sets.
- **Readonly properties** -- Mark immutable properties as `readonly`. Use `readonly class` in PHP 8.2+ for full immutability.
- **Named arguments** -- Use for functions with many optional parameters to improve readability.
- **Fibers** -- Low-level concurrency primitive; prefer framework abstractions (e.g., ReactPHP, Swoole) over direct fiber usage.
- **Attributes** -- Replace docblock annotations with native `#[Attribute]` for routing, validation, and ORM mapping.
- **Naming** -- PSR-12: PascalCase classes, camelCase methods, UPPER_SNAKE constants. One class per file.

## Tooling

| Tool | Purpose |
|------|---------|
| Composer | Dependency management and autoloading |
| PHPStan / Psalm | Static analysis (level 0-9 / max) |
| PHP CS Fixer / Pint | Code style formatting (PSR-12) |
| Rector | Automated refactoring and upgrades |
| Xdebug | Debugging and profiling |

## Project Structure

```
src/                  # Application source (PSR-4 autoloaded)
tests/                # PHPUnit test files
config/               # Configuration files
public/index.php      # Web entrypoint (single front controller)
composer.json         # Dependencies and autoload config
```

Follow PSR-4 autoloading: namespace maps to directory structure. Use `composer.json` `autoload` for source and `autoload-dev` for tests.

## Testing

- **PHPUnit** is the standard. Use `@dataProvider` for parameterized tests.
- **Mockery** or PHPUnit's built-in mocking for test doubles.
- **Pest** is a popular wrapper adding expressive syntax: `it('does something', function () { ... })`.
- Use `setUp()` / `tearDown()` for fixture management. Prefer in-memory SQLite for database tests.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Loose comparison (`==`) | Always use strict comparison (`===`); enable `strict_types` |
| Missing `declare(strict_types=1)` | Add to every file; configure PHPStan/Rector to enforce |
| Array as everything | Use typed DTOs/value objects instead of associative arrays for structured data |
| Silent type coercion | Strict types + PHPStan at level 8+ catches coercion issues |
| Global state / singletons | Use dependency injection; avoid `static` methods for stateful logic |

## Related Framework Skills

| Framework | Official Skill? | Link / Status |
|-----------|----------------|---------------|
| Laravel | No | Gap -- no comprehensive official skill |
| Symfony | No | Gap -- no official skill |
| WordPress | No | Gap -- no official skill |
| Livewire | No | Gap -- no official skill |

## Attribution
**Original** -- Datatide, MIT licensed.

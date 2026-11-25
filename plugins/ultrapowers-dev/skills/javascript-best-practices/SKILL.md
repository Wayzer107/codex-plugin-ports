---
name: javascript-best-practices
description: Modern JavaScript patterns for non-TypeScript projects covering ES2024+ idioms, tooling, and common pitfalls
---

# JavaScript Best Practices

Modern JavaScript patterns for projects that do not use TypeScript. Covers ES2024+ idioms, tooling, project structure, and common pitfalls.

## ES2024+ Idioms

- **Destructuring** -- Extract values from objects and arrays at assignment: `const { name, age } = user;`
- **Optional chaining** -- Safe property access: `user?.address?.city` instead of nested checks.
- **Nullish coalescing** -- Default only for `null`/`undefined`: `value ?? fallback` (not `||`, which catches `0` and `""`).
- **Promise.allSettled** -- When you need results from all promises regardless of rejection. Use `Promise.all` only when any failure should abort.
- **Array methods** -- Prefer `map`, `filter`, `find`, `some`, `every`, `flatMap` over manual loops. Use `Object.entries` / `Object.fromEntries` for object transformations.
- **ESM** -- Use `import` / `export` everywhere. Set `"type": "module"` in `package.json`. Use `.js` extensions in relative imports.
- **Top-level await** -- Available in ESM; use for async initialization scripts.
- **Structured clone** -- `structuredClone(obj)` for deep copies instead of JSON round-tripping.

## Tooling

- **ESLint** -- Enforce code quality. Use flat config (`eslint.config.js`). Start with `@eslint/js` recommended rules.
- **Prettier** -- Format on save. Configure once, never debate style.
- **JSDoc** -- Annotate function signatures with `@param`, `@returns`, and `@typedef` for editor IntelliSense and documentation without a compile step.

## Project Structure

- Group by feature, not by file type (`features/auth/`, not `controllers/`, `models/`).
- One module = one responsibility. Keep files under 200 lines where practical.
- Use barrel files (`index.js`) sparingly; they can cause circular imports and bundle bloat.

## Common Pitfalls

- **`this` binding** -- Arrow functions inherit `this` from enclosing scope. Use them for callbacks; use regular functions for object methods.
- **`==` vs `===`** -- Always use `===`. Loose equality has unintuitive coercion rules.
- **Hoisting** -- `var` is function-scoped and hoisted. Use `const` by default, `let` when reassignment is needed. Never use `var`.
- **Closure gotchas** -- Closures capture variables by reference. In loops, use `const` (block-scoped) or `for...of` to avoid stale references.
- **Event loop** -- `setTimeout(fn, 0)` does not run immediately; it queues a macrotask. Understand microtasks (promises) vs macrotasks (timers) to avoid race conditions.

## Related Framework Skills

| Framework | Skill |
|-----------|-------|
| React | `react-patterns`, `react-best-practices` |
| Vue | `vue-best-practices` |
| Angular | `angular-best-practices` |
| Express | `express-best-practices` |
| NestJS | `nestjs-best-practices` |
| Next.js | `nextjs-best-practices` |

---

Attribution: Original -- Datatide, MIT licensed.

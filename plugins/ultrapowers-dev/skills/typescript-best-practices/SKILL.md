---
name: typescript-best-practices
description: "Use when writing or reviewing TypeScript code. Covers type system patterns, modern tooling (biome, vitest), tsconfig settings, and testing conventions."
---

# TypeScript Best Practices

TypeScript adds a structural type system on top of JavaScript. Its power lies in encoding invariants at the type level -- discriminated unions, branded types, and conditional types catch entire categories of bugs before runtime.

## Idioms & Conventions

- **Discriminated unions over class hierarchies.** Tag with a literal field and narrow with `switch`:
  ```typescript
  type Event = { kind: "click"; x: number } | { kind: "keypress"; key: string };
  ```
- **Type narrowing with control flow.** Use `typeof`, `in`, and user-defined type guards (`is`) instead of casting with `as`.
- **`const` assertions** to preserve literal types: `const ROLES = ["admin", "user"] as const`.
- **`satisfies` operator** (5.0+) to validate a type while preserving the narrower inferred type: `const config = { port: 3000 } satisfies Config`.
- **Branded types** for nominal safety: `type UserId = string & { __brand: "UserId" }`.
- **`unknown` over `any`.** Force callers to narrow before use. Reserve `any` for FFI boundaries.
- **Readonly by default.** Use `Readonly<T>`, `ReadonlyArray<T>`, and `as const` to prevent mutation.
- **Avoid enums.** Prefer `as const` objects or union types -- they are erasable and work with type narrowing.

## Tooling

| Tool | Purpose |
|---|---|
| `npm` / `pnpm` | Package management (`pnpm` for monorepos) |
| `biome` | Lint + format in one tool (fast, replaces eslint + prettier) |
| `eslint` + `prettier` | Alternative lint/format stack (wider plugin ecosystem) |
| `tsc --noEmit` | Type checking without emitting (use in CI) |
| `tsx` / `ts-node` | Run `.ts` files directly during development |

## tsconfig Best Practices

Enable these in `compilerOptions` for maximum safety:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noFallthroughCasesInSwitch": true,
  "forceConsistentCasingInFileNames": true,
  "verbatimModuleSyntax": true
}
```

- **`strict: true`** enables `strictNullChecks`, `noImplicitAny`, and friends in one flag.
- **`noUncheckedIndexedAccess`** makes array/object indexing return `T | undefined` -- prevents silent `undefined` bugs.
- **`verbatimModuleSyntax`** enforces `import type` for type-only imports -- cleaner output and prevents runtime import side effects.

## Project Structure

```
src/
  index.ts            # Entry point / public API
  types.ts            # Shared type definitions
  config.ts
  services/
    user.service.ts
  utils/
    validation.ts
tests/
  user.service.test.ts
tsconfig.json
package.json
```

Use `.js` extensions in imports when targeting ESM (`"type": "module"` in `package.json`). TypeScript resolves `.js` to `.ts` during compilation.

## Testing with Vitest / Jest

- **Vitest for new projects** -- native ESM, TypeScript without config, compatible with Jest API.
- **Name files `*.test.ts`** or `*.spec.ts`. Co-locate with source or use a `tests/` directory.
- **`describe` / `it` blocks** for structure. One assertion per test where practical.
- **Use `vi.mock()` (Vitest) or `jest.mock()`** for module mocking. Mock at module boundaries, not internals.
- **Type-safe mocks:** `vi.fn<(arg: string) => number>()` to catch contract drift.
- **Snapshot tests:** use sparingly and only for serializable output (JSON, rendered components).

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Casting with `as` to silence errors | Use type guards or refine the types -- `as` hides bugs |
| Using `any` to "make it compile" | Use `unknown` and narrow, or fix the underlying type |
| Forgetting `null` checks with optional chaining | Enable `strictNullChecks`; handle `undefined` explicitly |
| Barrel files (`index.ts` re-exports) in large projects | They break tree-shaking and slow builds -- import directly |
| Not using `import type` for types | Enable `verbatimModuleSyntax` to enforce separation |

## Related Framework Skills

| Framework | Official Skill? | Status |
|-----------|:---:|--------|
| **React** | [Yes](https://github.com/vercel-labs/agent-skills) (221.6K installs) | `react-best-practices` in this repo (derived) |
| **Next.js** | [Yes](https://github.com/vercel-labs/next-skills) (37K installs) | `nextjs-patterns` in this repo complements it |
| **Vue** | [Yes](https://github.com/antfu/skills) (4.2K stars) | Reference official |
| **Angular** | No | `angular-patterns` in this repo |
| **Svelte** | Partial | Community only (192 stars) |
| **NestJS** | Partial | `nestjs-patterns` in this repo |
| **Express** | No | `express-patterns` in this repo |

## Attribution
**Original** — Datatide, MIT licensed. Inspired by [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) for React/Next.js patterns.

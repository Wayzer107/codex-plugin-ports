---
name: react-best-practices
description: Use when writing, reviewing, or refactoring React/Next.js code — 62 performance optimization rules across 8 categories, prioritized by impact
---

# React & Next.js Best Practices

Comprehensive performance optimization guide for React and Next.js applications. Contains 62 rules across 8 categories, prioritized by impact.

## When to Apply

- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Optimizing bundle size or load times

## Rule Categories by Priority

| Priority | Category | Impact | Key Rules |
|----------|----------|--------|-----------|
| 1 | Eliminating Waterfalls | CRITICAL | Promise.all() for independent ops, Suspense boundaries, defer await |
| 2 | Bundle Size | CRITICAL | Direct imports (no barrels), next/dynamic for heavy components, defer third-party scripts |
| 3 | Server-Side | HIGH | React.cache() dedup, minimize RSC serialization, parallel fetching |
| 4 | Client Data Fetching | MEDIUM-HIGH | SWR for dedup, passive event listeners, localStorage versioning |
| 5 | Re-render Optimization | MEDIUM | Functional setState, derive state during render, useTransition for non-urgent |
| 6 | Rendering | MEDIUM | content-visibility for lists, hoist static JSX, React DOM resource hints |
| 7 | JS Performance | LOW-MEDIUM | Avoid deep cloning, use Maps for lookups, debounce/throttle |
| 8 | Advanced Patterns | LOW | Worker offloading, streaming SSR, edge rendering |

## Critical Rules Quick Reference

### Eliminating Waterfalls
- Move `await` into branches where actually used
- `Promise.all()` for independent async operations
- Use `Suspense` to stream content progressively

### Bundle Size
- Import directly from module path, never from barrel `index.ts`
- `next/dynamic` for components not needed on initial load
- Load analytics/logging after hydration

### Server Performance
- `React.cache()` for per-request deduplication
- Minimize data passed from Server to Client Components
- Restructure component tree to parallelize data fetching

### Re-render Prevention
- Don't subscribe to state only used in callbacks
- Derive state during render, not in effects
- Use functional `setState` for stable callback references
- Never define components inside components

## Full Rule Reference

For the complete 62-rule reference with code examples, see the upstream source:
[vercel-labs/agent-skills/react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)

## Attribution

**Derived from** [vercel-labs/agent-skills/react-best-practices](https://github.com/vercel-labs/agent-skills) — MIT licensed, Copyright (c) Vercel. Condensed from the original 62-rule index with full rule files. See upstream for detailed per-rule documentation.

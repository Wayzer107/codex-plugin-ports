---
name: nextjs-patterns
description: "Use when building or reviewing Next.js applications. Covers App Router, Server Components, Server Actions, data fetching, caching, ISR, and middleware patterns."
---

# Next.js Patterns

The App Router defaults to Server Components -- code runs on the server unless you opt in to the client. Understand the boundary and you control performance.

## App Router Fundamentals

- **`app/` directory** uses file-system routing. `page.tsx` renders a route, `layout.tsx` wraps children, `loading.tsx` provides Suspense fallbacks.
- **Server Components by default.** Add `'use client'` only when you need browser APIs, state, or event handlers.
- **Push `'use client'` as low as possible.** Keep parent layouts as Server Components; wrap only the interactive leaf.

## Server Actions

- Define with `'use server'` directive at the top of a function or file.
- Use for form submissions, mutations, and revalidation -- replaces API routes for many use cases.
- Call `revalidatePath()` or `revalidateTag()` after mutations to refresh cached data.
- Validate inputs with Zod on the server side -- never trust client data.

## Data Fetching & Caching

- **`fetch()` in Server Components** is extended with caching: `fetch(url, { next: { revalidate: 60 } })`.
- **Static by default.** Pages are statically rendered unless they use dynamic functions (`cookies()`, `headers()`, `searchParams`).
- **ISR:** set `revalidate` to rebuild pages in the background without full redeploy.

## Middleware

- `middleware.ts` at the project root runs before routing. Use for auth redirects, geolocation, A/B testing.
- **Keep middleware lightweight** -- it runs on the Edge Runtime with limited APIs.

## Route Organization

- **Route groups** `(name)` organize code without affecting URLs.
- **Parallel routes** `@slot` and **intercepting routes** `(.)` for modals and complex layouts.
- **API routes** via `route.ts` for webhooks and external integrations.

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Adding `'use client'` to entire pages | Move interactivity to leaf components; keep page as Server Component |
| Fetching in Client Components when Server Components suffice | Fetch on the server, pass data as props |
| Missing `loading.tsx` causing layout shifts | Add `loading.tsx` or `<Suspense>` boundaries for async content |
| Not revalidating after Server Action mutations | Call `revalidatePath()` or `revalidateTag()` post-mutation |
| Large client bundles from barrel exports | Import directly from module paths, not `index.ts` |

## Attribution
**Original** -- Datatide, MIT licensed. See also [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) for official Next.js skills.

---
name: react-patterns
description: Canonical patterns for React applications covering component design, hooks, state management, and data fetching
---

# React Patterns

Canonical patterns for building React applications. Covers component design, hooks, state management, data fetching, and accessibility.

## When to Use

Use this skill when building or reviewing React components, choosing state management strategies, designing component APIs, or implementing data fetching. For performance optimization (memoization thresholds, bundle analysis, render profiling), see also `react-best-practices`.

## Functional Components

- Always use function declarations or arrow functions; never class components for new code.
- Keep components small and focused on a single responsibility.
- Extract logic into custom hooks when it is reused or complex.

## Hooks Patterns

- **useState** -- Use for simple local state. Prefer updater functions (`setCount(c => c + 1)`) when new state depends on previous.
- **useEffect** -- Runs side effects. Always specify a dependency array. Clean up subscriptions and timers in the return function.
- **useCallback** -- Stabilize callback references passed to memoized children. Do not wrap every function; only when identity matters.
- **useMemo** -- Cache expensive computations. Profile before adding; premature memoization adds complexity.
- **useRef** -- Access DOM nodes or persist mutable values across renders without triggering re-renders.
- **Custom Hooks** -- Prefix with `use`. Encapsulate stateful logic (e.g., `useLocalStorage`, `useDebounce`). Return tuples or objects, not raw values.

## State Management

| Scope | Tool |
|-------|------|
| Component-local | `useState`, `useReducer` |
| Subtree / theme / auth | React Context + `useContext` |
| Global / async / complex | Zustand, Jotai, or TanStack Store |

Avoid prop drilling beyond two levels -- lift state up or introduce context. Keep context providers narrow to limit re-renders.

## Component Composition

- Prefer composition over configuration props. Use `children`, render props, or compound components (e.g., `<Tabs>` / `<Tabs.Panel>`).
- Use polymorphic `as` props sparingly; prefer explicit wrappers.

## Data Fetching

- **Server Components (Next.js App Router)** -- Fetch data on the server by default. Use `async` components with `await`.
- **Suspense** -- Wrap async components in `<Suspense fallback={...}>` for streaming and loading states.
- **Client-side** -- Use SWR or TanStack Query for cache, revalidation, and optimistic updates. Avoid `useEffect` + `fetch` for non-trivial cases.

## Error Boundaries

- Wrap route segments and critical UI sections in error boundaries.
- Use `react-error-boundary` or a custom class component (the one remaining valid use of classes).
- Provide a fallback UI and a retry mechanism.

## Form Handling

- Use React Hook Form or controlled components with `useState`.
- Validate with Zod or Yup schemas; share schemas between client and server when possible.
- Disable submit buttons during pending state; show inline field errors.

## Accessibility

- Use semantic HTML elements (`button`, `nav`, `main`, `dialog`) before adding ARIA.
- Manage focus: trap focus in modals, restore focus on close, auto-focus first input in forms.
- All interactive elements must be keyboard-accessible. Test with screen readers.
- Provide `aria-label` or `aria-labelledby` for icon-only buttons and custom widgets.

---

Attribution: Original -- Datatide, MIT licensed. For performance optimization rules, see also `react-best-practices` (derived from Vercel).

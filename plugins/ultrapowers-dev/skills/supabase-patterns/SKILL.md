---
name: supabase-patterns
description: "Use when building with Supabase. Covers row-level security, realtime subscriptions, edge functions, auth, and PostgreSQL best practices within the Supabase platform."
---

# Supabase Patterns

Supabase is PostgreSQL with batteries: auth, realtime, storage, and edge functions. If RLS is off, your data is public.

## Row-Level Security (RLS)

- **Enable RLS on every table** exposed via the API: `ALTER TABLE posts ENABLE ROW LEVEL SECURITY;`.
- **Deny by default.** With RLS enabled and no policies, all access is blocked. Add policies explicitly.
- **Use `auth.uid()`** in policies: `CREATE POLICY "own posts" ON posts FOR SELECT USING (user_id = auth.uid())`.
- **Separate policies per operation:** SELECT, INSERT, UPDATE, DELETE each need their own policy.

## Auth

- **Use `@supabase/ssr`** for Next.js or `@supabase/auth-helpers-*` for other frameworks.
- **Server-side client** (`createServerClient()`) reads cookies and validates JWT automatically.
- **Never trust the client JWT alone** -- RLS policies are the real enforcement layer.
- **Custom claims** via `raw_app_meta_data` for role-based access.

## Realtime Subscriptions

- **Enable realtime per table** via `ALTER PUBLICATION supabase_realtime ADD TABLE posts;`.
- **Subscribe in client** using `supabase.channel('posts').on('postgres_changes', ...)`.
- **RLS applies to realtime** -- users only receive events for rows they can SELECT.
- **Unsubscribe on cleanup** to avoid memory leaks: `supabase.removeChannel(channel)`.

## Edge Functions

- **Deno-based** serverless functions deployed to Supabase's edge network.
- Use for webhooks, third-party API calls, and server-only logic.
- **Create with:** `supabase functions new my-function`, deploy with `supabase functions deploy`.
- **Service role key bypasses RLS** -- use only in trusted server contexts, never expose to clients.

## PostgreSQL in Supabase

- **Use migrations** via `supabase migration new` -- never modify production schemas manually.
- **Indexes on filtered/joined columns** -- check with `EXPLAIN ANALYZE` in the SQL editor.
- **Database functions** (`CREATE FUNCTION`) keep business rules in the database, callable via `supabase.rpc()`.

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| RLS disabled on public tables | Enable RLS immediately; add policies before exposing via API |
| Using `service_role` key in client code | Client must use `anon` key; service role bypasses all security |
| Missing realtime publication for table | Add table to `supabase_realtime` publication |
| Not unsubscribing from channels | Clean up in `useEffect` return or component unmount |

## Attribution
**Original** -- Datatide, MIT licensed. See also [supabase/agent-skills](https://github.com/supabase/agent-skills) for official Supabase skills.

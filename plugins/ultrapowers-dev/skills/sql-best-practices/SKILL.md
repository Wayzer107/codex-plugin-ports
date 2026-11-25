---
name: sql-best-practices
description: "Use when writing or reviewing SQL queries. Covers query optimization, indexing strategies, JOINs, CTEs, window functions, and EXPLAIN analysis across PostgreSQL, MySQL, and SQLite."
---

# SQL Best Practices

Every slow query has a missing index or an unnecessary scan. Tell the database *what* you want and give it the indexes to find it fast.

## Query Optimization

- **Select only needed columns.** Never `SELECT *` in production -- it prevents covering indexes and wastes bandwidth.
- **Filter early.** Push `WHERE` clauses as close to base tables as possible; filter before joining.
- **Avoid functions on indexed columns** in WHERE clauses: `WHERE created_at >= '2024-01-01'` not `WHERE YEAR(created_at) = 2024`.

## Indexing

- **Index columns in WHERE, JOIN, and ORDER BY clauses.** Check query plans to verify index usage.
- **Composite indexes:** put high-selectivity columns first; the leftmost prefix rule applies.
- **Don't over-index.** Each index slows writes. Remove unused indexes periodically.

## JOINs & CTEs

- **Prefer explicit JOIN syntax** over comma-separated tables. Always specify `INNER`, `LEFT`, etc.
- **CTEs for readability.** Use `WITH` clauses to name intermediate result sets.
- **Recursive CTEs** for tree/graph traversal: `WITH RECURSIVE` (PostgreSQL, MySQL 8+, SQLite 3.8.3+).

## Window Functions

- **Ranking:** `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()` over `PARTITION BY ... ORDER BY ...`.
- **Deduplication:** `ROW_NUMBER() OVER (PARTITION BY key ORDER BY updated_at DESC)` then filter to `rn = 1`.

## EXPLAIN Analysis

- **PostgreSQL:** `EXPLAIN (ANALYZE, BUFFERS)` -- look for `Seq Scan` on large tables.
- **MySQL:** `EXPLAIN ANALYZE` (8.0.18+) -- watch for `Full Table Scan`.
- **SQLite:** `EXPLAIN QUERY PLAN` -- check for `SCAN TABLE` vs `SEARCH TABLE USING INDEX`.

## N+1 Detection

- **Symptom:** one query per row in application code (loop of SELECTs).
- **Fix:** batch with `WHERE id IN (...)`, use JOINs, or use ORM eager-loading (`include`, `joinedload`).

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| N+1 queries from ORM lazy loading | Eager-load associations or batch fetch |
| Missing index on foreign key columns | Always index FK columns -- JOINs and cascading deletes need them |
| `SELECT *` in production queries | List explicit columns; enables covering indexes |
| Implicit type casting in WHERE | Match column types exactly to avoid index bypass |
| Unbounded queries (no LIMIT) | Always paginate user-facing queries with LIMIT/OFFSET or cursor |

## Attribution
**Original** -- Datatide, MIT licensed.

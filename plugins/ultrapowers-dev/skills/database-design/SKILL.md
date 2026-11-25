---
name: database-design
description: "Use when designing schemas, writing migrations, optimizing queries, choosing indexes, or deciding between normalization and denormalization.\n"
---

# Database Design

Normalize by default, denormalize with intent. Every index speeds up reads and slows down writes -- choose deliberately.

## When to Use

- Designing a new schema or adding tables
- Optimizing slow queries
- Planning migrations for a production database

## Normalization Quick Guide

| Normal Form | Rule | Violation Example |
|-------------|------|------------------|
| 1NF | Atomic values, no repeating groups | `tags: "a,b,c"` in a single column |
| 2NF | No partial dependencies on composite keys | Column depends on only part of the key |
| 3NF | No transitive dependencies | `order.customer_name` when you have `customer_id` |

**Start at 3NF.** Denormalize only when measured query performance justifies it.

## When to Denormalize

| Situation | Approach |
|-----------|----------|
| Expensive joins on read-heavy paths | Materialized view or summary table |
| Frequently accessed computed value | Store it, update on write |
| Cross-service data (can't join) | Duplicate what you need, sync via events |

Always document *why* you denormalized and *how* consistency is maintained.

## Index Selection

| Query Pattern | Index Type |
|--------------|------------|
| Exact match (`WHERE status = ?`) | B-tree on that column |
| Range query (`WHERE created_at > ?`) | B-tree on that column |
| Multi-column filter | Composite index: equality columns first, range last |
| Full-text search | Full-text index or search engine |

**Composite index order**: `(tenant_id, status, created_at)` -- equality columns first, range column last.

## Migration Safety

| Operation | Safe Approach |
|-----------|--------------|
| Add column | Nullable or with default; never NOT NULL without default |
| Remove column | Stop reading first, deploy, then drop |
| Rename column | Add new, copy, migrate readers, drop old |
| Add index | Concurrently if supported (avoids locking) |

Every migration must be reversible or have a documented rollback plan.

## Query Optimization

| Check | Action |
|-------|--------|
| Missing index | EXPLAIN; look for sequential scans |
| N+1 queries | Batch or join in one query |
| SELECT * | Select only needed columns |
| Unbounded queries | Always LIMIT; paginate results |
| Unused indexes | Drop them -- they cost write performance |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| No indexes on foreign keys | Index every FK column |
| Indexing every column "just in case" | Index based on actual query patterns |
| Storing money as floating point | Use integer cents or decimal type |
| DDL without a migration tool | Use versioned, reviewable migration files |
| Giant transactions locking many rows | Smaller batches, commit frequently |

## Attribution
**Original** -- Datatide, MIT licensed.

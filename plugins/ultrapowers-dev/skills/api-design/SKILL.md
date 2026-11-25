---
name: api-design
description: "Use when designing REST APIs, choosing URL structures, handling errors in responses, implementing pagination, or planning API versioning.\n"
---

# API Design

Design APIs for the consumer, not the database. Consistent conventions, clear errors, and predictable behavior matter more than cleverness.

## When to Use

- Designing new endpoints or standardizing existing ones
- Implementing pagination, filtering, or error responses
- Planning versioning strategy

## REST URL Conventions

| Pattern | Example | Rule |
|---------|---------|------|
| Collection | `GET /users` | Plural nouns, never verbs |
| Single resource | `GET /users/42` | ID in path |
| Nested resource | `GET /users/42/orders` | One level deep max |
| Action (rare) | `POST /orders/42/cancel` | Verb only when CRUD doesn't fit |
| Filtering | `GET /users?status=active` | Query params for filters |

Avoid deep nesting. After two levels, promote to top-level with a filter.

## Status Codes That Matter

| Code | When to Use |
|------|-------------|
| 200 | Successful read or update |
| 201 | Created (return resource + Location header) |
| 204 | Successful delete, nothing to return |
| 400 | Malformed input |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but not permitted |
| 404 | Resource doesn't exist |
| 409 | Duplicate or state conflict |
| 429 | Rate limit exceeded |
| 500 | Unexpected failure (don't expose details) |

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable summary",
    "details": [{"field": "email", "issue": "must be valid"}]
  }
}
```

Always include a machine-readable code. Never expose stack traces in production.

## Pagination

| Style | Best For |
|-------|----------|
| Offset (`?page=3&per_page=20`) | Simple, supports "jump to page" |
| Cursor (`?cursor=abc&limit=20`) | Large/changing datasets, stable under inserts |

**Default**: cursor-based for anything that grows. Offset breaks when rows are inserted during traversal.

## Versioning

| Strategy | Trade-off |
|----------|-----------|
| URL path (`/v1/users`) | Simple, obvious, harder to migrate |
| Header-based | Clean URLs, less discoverable |
| No versioning | Best if you control all clients |

**Default**: URL path. Only bump for breaking changes. Additive changes (new fields) don't need a new version.

## Rate Limiting

Return limits in headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Return `429` with `Retry-After` when exceeded.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Verbs in URLs (`/getUsers`) | Use nouns + HTTP methods |
| Returning 200 with error in body | Use proper status codes |
| Inconsistent error formats | One error schema everywhere |
| No pagination on list endpoints | Always paginate; unbounded lists break at scale |
| Breaking changes without version bump | Additive only; new version for removals |

## Attribution
**Original** -- Datatide, MIT licensed.

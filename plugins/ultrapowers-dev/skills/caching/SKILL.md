---
name: caching
description: "Use when adding caching to a system, choosing cache strategies, designing invalidation logic, or diagnosing cache-related bugs.\n"
---

# Caching

Cache the right thing at the right layer with the right TTL. The two hardest problems in caching are invalidation and knowing when not to cache at all.

## When to Use

- A read path is slow and data doesn't change every request
- Reducing load on a database or external API
- Debugging stale data or inconsistency issues

## Caching Strategies

| Strategy | How It Works | Best For |
|----------|-------------|----------|
| Cache-Aside | App checks cache, on miss reads source and populates | General purpose, most common |
| Read-Through | Cache fetches from source on miss | Cache layer manages population |
| Write-Through | Writes go to cache and source synchronously | Strong consistency |
| Write-Behind | Writes to cache, async flush to source | High write throughput |

**Default**: cache-aside. Simple, explicit, you control both paths.

## Cache-Aside Flow

```
read(key):
  value = cache.get(key)
  if miss: value = db.get(key); cache.set(key, value, ttl)
  return value

write(key, value):
  db.set(key, value)
  cache.delete(key)   // Delete, don't update
```

**Delete on write, don't update** -- updating risks race conditions where a stale write overwrites a newer one.

## Invalidation Strategies

| Strategy | Trade-off |
|----------|-----------|
| TTL-based | Simple but serves stale data until expiry |
| Event-based | Consistent but requires event infrastructure |
| Version-based | Good for static assets, manual management |
| Purge on deploy | Safe for config/template caches |

## TTL Guidelines

| Data Type | Suggested TTL |
|-----------|--------------|
| User session | 15-30 minutes |
| External API response | 60-300 seconds |
| Config / feature flags | 30-60 seconds |
| Static assets | Hours to days (version URLs handle invalidation) |

## When Caching Hurts

| Scenario | Why |
|----------|-----|
| Write-heavy, read-once data | Cache churn with no read benefit |
| Highly personalized data | Low hit rate, memory wasted |
| Must be real-time consistent | Stale cache causes correctness bugs |
| Cache same speed as source | Complexity without performance gain |

## Thundering Herd Prevention

| Technique | How It Works |
|-----------|-------------|
| Lock on cache miss | One request populates, others wait |
| Stale-while-revalidate | Serve expired value, refresh in background |
| Request coalescing | Deduplicate concurrent requests for same key |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| No TTL set | Always set a TTL -- prevents infinite stale data |
| Updating cache on write instead of deleting | Delete on write; next read repopulates |
| Caching errors or empty results | Cache only successful responses |
| No hit/miss monitoring | Track hit rate -- below 80% means cache isn't helping |
| Ignoring cold-start behavior | Plan warm-up or stale-while-revalidate |

## Attribution
**Original** -- Datatide, MIT licensed.

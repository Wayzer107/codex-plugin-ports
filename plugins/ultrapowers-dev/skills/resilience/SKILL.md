---
name: resilience
description: "Use when building systems that must survive transient failures, network partitions, and downstream service degradation."
---

# Resilience

Systems fail. Resilient systems fail gracefully — they contain blast radius, recover automatically from transient faults, and degrade instead of collapse.

## When to Use

- Calling external APIs or downstream services
- Designing retry logic for flaky operations
- Protecting a service from cascade failures
- Handling partial outages without full system downtime

## Core Patterns

| Pattern | Purpose | Key Idea |
|---------|---------|----------|
| **Retry + Backoff** | Survive transient faults | Wait longer between each attempt |
| **Circuit Breaker** | Stop hammering a broken dependency | Fail fast when errors exceed threshold |
| **Timeout** | Bound wait time for slow calls | Every outgoing call needs a deadline |
| **Bulkhead** | Isolate failure domains | Separate resource pools per dependency |
| **Fallback** | Provide degraded experience | Return cached/default data when primary fails |

## Retry with Exponential Backoff

```
delay = base_delay * 2^attempt + random_jitter
```

| Parameter | Recommended Value |
|-----------|------------------|
| Base delay | 100-500ms |
| Max retries | 3-5 |
| Max delay cap | 30-60s |
| Jitter | Random 0-100% of calculated delay |

**Only retry on transient errors** — network timeouts, 503s, connection resets. Never retry 400s, 401s, or 409s.

## Circuit Breaker States

```
CLOSED  --[failure threshold exceeded]--> OPEN
OPEN    --[timeout elapsed]-------------> HALF-OPEN
HALF-OPEN --[probe succeeds]------------> CLOSED
HALF-OPEN --[probe fails]--------------> OPEN
```

- **Closed:** requests flow normally, failures are counted
- **Open:** requests fail immediately, no downstream calls
- **Half-Open:** one probe request allowed; success resets, failure re-opens

Typical config: open after 5 failures in 60 seconds, probe after 30 seconds.

## Timeouts

| Call Type | Guideline |
|-----------|-----------|
| Database query | 1-5s |
| Internal service call | 2-10s |
| External API call | 5-30s |
| User-facing total | Budget across all downstream calls |

Always set **both** connection timeout and request timeout. A missing timeout is a resource leak waiting to happen.

## Bulkhead Isolation

Assign separate thread pools, connection pools, or rate limits per dependency. When one downstream service stalls, only its pool is exhausted — other dependencies continue serving.

**Example:** Payment service gets 20 connections, Inventory service gets 15, Email service gets 5. Email going down cannot starve payment processing.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Retrying non-idempotent operations | Ensure idempotency (idempotency keys) before adding retries |
| Retrying without jitter | Always add random jitter to prevent thundering herd |
| No timeout on outgoing calls | Set explicit timeouts on every HTTP client and DB connection |
| Circuit breaker thresholds too sensitive | Tune to avoid flapping — use error *rate*, not count |
| Single shared connection pool | Use bulkheads to isolate critical from non-critical paths |

## Attribution
**Original** — Datatide, MIT licensed.

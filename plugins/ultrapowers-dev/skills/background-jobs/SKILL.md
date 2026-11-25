---
name: background-jobs
description: "Use when designing task queues, async workers, or event-driven processing that runs outside the request-response cycle."
---

# Background Jobs

Work that does not need to complete within a user request belongs in a background job. Decouple production from consumption, and design every job to be safely retried.

## When to Use

- Processing takes longer than an acceptable response time (>500ms)
- Work can be deferred (emails, reports, thumbnails, webhooks)
- You need to fan out or parallelize processing
- Handling events from other services asynchronously

## Delivery Semantics

| Semantic | Guarantee | Practical Reality |
|----------|-----------|-------------------|
| **At-most-once** | May lose messages, never duplicates | Fire-and-forget; acceptable for analytics pings |
| **At-least-once** | No message loss, may duplicate | Most queues default here; **requires idempotent consumers** |
| **Exactly-once** | No loss, no duplicates | Extremely hard; approximate with at-least-once + idempotency |

Default to at-least-once and make consumers idempotent.

## Job Design Principles

| Principle | Detail |
|-----------|--------|
| **Idempotency** | Processing a job twice must produce the same result; use idempotency keys |
| **Small payload** | Store a reference (ID/URL) in the job, not the full data |
| **Timeout** | Every job needs a max execution time; kill and retry if exceeded |
| **Isolation** | One job failure must not block or crash other jobs |
| **Observability** | Log job ID, type, duration, and outcome on every execution |

## Queue Architecture

```
Producer --> Queue --> Worker(s) --> Success / Failure
                                       |
                                   Retry Queue (with backoff)
                                       |
                                   Dead Letter Queue (DLQ)
```

- **Retry queue:** Failed jobs re-enter with exponential backoff (max 3-5 retries)
- **Dead letter queue (DLQ):** Jobs that exhaust retries land here for manual inspection
- **Monitor DLQ size** — a growing DLQ signals a systemic problem, not a transient blip

## Idempotency Strategies

| Strategy | How It Works |
|----------|-------------|
| **Idempotency key** | Caller provides a unique key; server deduplicates on that key |
| **Database constraint** | Use unique constraints to prevent duplicate writes |
| **State check before action** | Verify current state before applying change (check-then-act) |
| **Tombstone/processed flag** | Mark job ID as processed; skip if already marked |

## Scaling Workers

- Scale workers horizontally based on queue depth
- Use visibility timeout / acknowledgment: a job is invisible to other workers until ack'd or timeout
- Prefer pull-based consumption over push for backpressure control
- Partition queues by priority: critical jobs should not wait behind bulk jobs

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| No idempotency on consumers | Add idempotency keys or deduplication checks |
| Giant payloads in the queue | Store references; fetch data inside the worker |
| Ignoring the dead letter queue | Alert on DLQ depth; review and reprocess regularly |
| Unbounded retries | Cap retries (3-5) with exponential backoff, then DLQ |
| No job timeout | Set max execution time; terminate and re-queue if exceeded |

## Attribution
**Original** — Datatide, MIT licensed.

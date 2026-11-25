---
name: observability
description: "Use when instrumenting systems with structured logging, metrics, and distributed tracing to achieve production visibility."
---

# Observability

Production systems require three pillars — logs, metrics, and traces — working together to answer any question about system behavior without deploying new code.

## When to Use

- Adding logging, metrics, or tracing to a service
- Debugging production issues or performance regressions
- Designing alerting and on-call dashboards
- Evaluating whether your system is actually observable

## The Three Pillars

| Pillar | Purpose | Key Principle |
|--------|---------|---------------|
| **Logs** | Discrete events with context | Structured, not free-text |
| **Metrics** | Aggregated numerical measurements | Pre-aggregated, cheap to query |
| **Traces** | Request flow across service boundaries | Correlated via trace/span IDs |

## Structured Logging

Always emit logs as key-value pairs, never interpolated strings.

**Good:** `{"level":"error","service":"payments","order_id":"abc-123","msg":"charge failed","error":"card_declined"}`

**Bad:** `Error: charge failed for order abc-123 because card was declined`

**Rules:**
- Include `request_id`, `user_id`, and `service` on every log line
- Use consistent severity levels: DEBUG, INFO, WARN, ERROR
- Log at boundaries: incoming requests, outgoing calls, decisions
- Never log secrets, tokens, or PII

## Metrics Frameworks

| Framework | Applies To | Measures |
|-----------|-----------|----------|
| **RED** | Request-driven services | **R**ate, **E**rrors, **D**uration |
| **USE** | Infrastructure resources | **U**tilization, **S**aturation, **E**rrors |

Start with RED for every service endpoint. Add USE for databases, queues, and connection pools.

## Distributed Tracing

- Propagate a `trace_id` through every inter-service call (HTTP headers, message metadata)
- Create child **spans** for meaningful units of work (DB query, cache lookup, external API call)
- Record span attributes: status code, row count, cache hit/miss
- Sample intelligently — 100% of errors, 1-10% of successes

## Alerting Principles

| Principle | Detail |
|-----------|--------|
| Alert on symptoms, not causes | Alert on "error rate > 5%" not "disk at 80%" |
| Every alert needs a runbook | If you can't write one, the alert is premature |
| Avoid alert fatigue | Fewer, actionable alerts beat many noisy ones |
| Use severity tiers | Page for customer impact; ticket for degradation |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Logging unstructured strings | Use structured key-value format consistently |
| Metrics with unbounded cardinality | Never use user IDs or request IDs as metric labels |
| No correlation between pillars | Attach `trace_id` to logs and metrics for cross-referencing |
| Alerting on every error | Set thresholds based on error *rate*, not individual occurrences |
| Tracing only happy paths | Ensure error paths and timeouts produce spans too |

## Attribution
**Original** — Datatide, MIT licensed.

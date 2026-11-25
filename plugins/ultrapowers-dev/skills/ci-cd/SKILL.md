---
name: ci-cd
description: "Use when designing continuous integration and deployment pipelines — covering stages, deployment strategies, rollback, and pipeline performance."
---

# CI/CD

A good pipeline gives fast, reliable feedback on every change and deploys to production with confidence. Keep pipelines fast, keep deployments reversible.

## When to Use

- Setting up or improving a build/deploy pipeline
- Choosing a deployment strategy (blue-green, canary, rolling)
- Reducing pipeline execution time
- Designing rollback procedures

## Pipeline Stages

| Stage | Purpose | Speed Target |
|-------|---------|-------------|
| **Lint & Format** | Catch style issues immediately | <30s |
| **Build** | Compile, bundle, generate artifacts | <2 min |
| **Unit Tests** | Fast, isolated correctness checks | <2 min |
| **Integration Tests** | Verify component interactions | <5 min |
| **Security Scan** | Dependency vulnerabilities, SAST | <3 min |
| **Deploy to Staging** | Validate in production-like environment | <5 min |
| **Deploy to Production** | Ship to users | <5 min |

**Total pipeline target:** under 15 minutes. If it's slower, developers stop waiting and stop caring.

## Keeping Pipelines Fast

| Technique | Impact |
|-----------|--------|
| **Parallelize stages** | Run lint, build, and test concurrently where independent |
| **Cache dependencies** | Cache package manager downloads and build artifacts between runs |
| **Incremental builds** | Only rebuild what changed (monorepo tools, build caches) |
| **Test splitting** | Distribute test suites across parallel runners |
| **Fail fast** | Run fastest checks first; abort on first failure |

## Deployment Strategies

| Strategy | How It Works | Rollback Speed | Risk |
|----------|-------------|----------------|------|
| **Blue-Green** | Two identical environments; swap traffic | Instant (swap back) | Low; full validation before switch |
| **Canary** | Route small % of traffic to new version | Fast (route to old) | Low; gradual exposure |
| **Rolling** | Replace instances incrementally | Moderate | Medium; mixed versions during deploy |
| **Recreate** | Stop old, start new | Slow (redeploy) | High; causes downtime |

**Default recommendation:** Blue-green for simplicity, canary when you need gradual rollout with metrics validation.

## Rollback Principles

- Every deployment must be reversible within minutes
- Keep the previous version's artifacts available (never delete on deploy)
- Database migrations must be backward-compatible (expand-then-contract)
- Automate rollback triggers: error rate spike, health check failure, latency threshold

## Branch and Merge Strategy

| Practice | Guideline |
|----------|-----------|
| Trunk-based development | Short-lived branches (<1 day), merge to main frequently |
| Feature flags | Decouple deployment from release; ship dark features |
| No long-lived branches | They rot; merge conflicts grow exponentially with time |
| CI runs on every push | Every commit gets full pipeline feedback |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Pipeline takes >20 minutes | Parallelize, cache, split tests, fail fast |
| No rollback plan | Automate rollback; test it regularly |
| Deploying database migrations that break old code | Use expand-contract pattern for schema changes |
| Skipping staging | Always validate in a production-like environment first |
| Manual deployment steps | Automate everything; manual steps are error-prone and unrepeatable |

## Attribution
**Original** — Datatide, MIT licensed.

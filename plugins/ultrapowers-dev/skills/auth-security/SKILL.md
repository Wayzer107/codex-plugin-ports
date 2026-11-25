---
name: auth-security
description: "Use when implementing authentication, authorization, or security controls — covering identity, access, and defense against common vulnerabilities."
---

# Auth & Security

Never roll your own crypto. Use proven libraries, follow established standards, and treat security as a constraint on every design decision — not an afterthought.

## When to Use

- Adding login, signup, or identity management
- Implementing role-based or attribute-based access control
- Reviewing code for security vulnerabilities
- Managing secrets, tokens, or API keys

## Authentication vs Authorization

| Concern | Question Answered | Examples |
|---------|------------------|----------|
| **Authentication (AuthN)** | *Who are you?* | Password, OAuth, MFA, SSO |
| **Authorization (AuthZ)** | *What can you do?* | RBAC, ABAC, policies, scopes |

Always authenticate first, then authorize. Never conflate the two.

## Token Strategies

| Strategy | Best For | Tradeoff |
|----------|----------|----------|
| **Session cookies** | Server-rendered apps | Requires session store; built-in CSRF protection with SameSite |
| **JWT (access token)** | APIs, microservices | Stateless but irrevocable until expiry |
| **JWT + refresh token** | SPAs, mobile apps | Short-lived access (5-15 min), long-lived refresh (days) |

**JWT rules:** Keep payloads small. Never store secrets in claims. Always validate signature, issuer, audience, and expiration.

## Access Control Models

| Model | Mechanism | Use When |
|-------|-----------|----------|
| **RBAC** | Users have roles, roles have permissions | Clear organizational hierarchy |
| **ABAC** | Policies evaluate attributes (user, resource, context) | Complex, context-dependent rules |
| **ReBAC** | Permissions derived from relationships | Social graphs, document sharing |

Start with RBAC. Move to ABAC/ReBAC when RBAC role explosion becomes unmanageable.

## OWASP Top 10 — Quick Defenses

| Vulnerability | Defense |
|--------------|---------|
| Injection (SQL, NoSQL, OS) | Parameterized queries, never concatenate input |
| Broken authentication | MFA, rate-limit login, secure password hashing (bcrypt/argon2) |
| Sensitive data exposure | Encrypt at rest and in transit, minimize data collection |
| Broken access control | Check permissions server-side on every request |
| Security misconfiguration | Disable defaults, automate hardening, audit headers |
| XSS | Output-encode all user content, use CSP headers |
| CSRF | SameSite cookies, anti-CSRF tokens for state-changing requests |

## Secrets Management

- **Never** commit secrets to version control
- Use environment variables or a secrets manager (Vault, cloud KMS)
- Rotate secrets on a schedule and immediately after any suspected leak
- Audit access to secrets — who read what, when

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Rolling custom password hashing | Use bcrypt, scrypt, or argon2 from a trusted library |
| Storing JWTs in localStorage | Use httpOnly, Secure, SameSite cookies |
| Checking permissions only in the UI | Enforce authorization server-side on every endpoint |
| Hardcoding secrets in source code | Use environment variables or a secrets manager |
| Missing rate limiting on auth endpoints | Rate-limit login, registration, and password reset |

## Attribution
**Original** — Datatide, MIT licensed.

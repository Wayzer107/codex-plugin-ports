---
name: e2e-testing
description: Use when writing end-to-end UI tests, setting up Playwright or Cypress, or debugging flaky tests — covers test structure, selectors, waiting strategies, and CI integration
---

# E2E Testing

## Overview

End-to-end tests verify that your application works from the user's perspective. They're slower than unit tests but catch integration issues nothing else can.

## Tool Selection

| Tool | Best for | Browsers |
|------|----------|----------|
| **Playwright** | Modern default, fast, reliable | Chromium, Firefox, WebKit |
| **Cypress** | Component testing, time-travel debug | Chromium, Firefox, Edge |

**Default recommendation: Playwright.** Better parallelism, multi-browser support, and API testing built in.

## Test Structure

```
tests/
  e2e/
    auth.spec.ts          # Login, signup, logout flows
    dashboard.spec.ts     # Main app functionality
    checkout.spec.ts      # Critical business path
  fixtures/
    test-user.ts          # Shared test data
  support/
    helpers.ts            # Reusable actions (login, seed data)
```

## Core Patterns

### Page Object Model (optional but recommended for large suites)

```typescript
class LoginPage {
  constructor(private page: Page) {}
  async login(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }
}
```

### Selector Priority

| Priority | Selector | Example |
|----------|----------|---------|
| 1 | Role | `getByRole('button', { name: 'Submit' })` |
| 2 | Label | `getByLabel('Email')` |
| 3 | Text | `getByText('Welcome')` |
| 4 | Test ID | `getByTestId('checkout-btn')` |
| 5 | CSS (last resort) | `locator('.btn-primary')` |

Prefer accessible selectors — they test what users see and survive refactors.

### Waiting Strategy

```typescript
// GOOD: wait for specific condition
await expect(page.getByText('Order confirmed')).toBeVisible();

// BAD: arbitrary timeout
await page.waitForTimeout(3000);
```

Never use fixed timeouts. Wait for:
- Elements to appear/disappear
- Network requests to complete
- URL to change
- Specific text content

## What to E2E Test

- **Critical user journeys** — signup, login, checkout, core workflow
- **Integration points** — payment processing, third-party auth, email
- **Cross-browser rendering** — layout and functionality across browsers

## What NOT to E2E Test

- Individual component behavior (use unit/component tests)
- API response formats (use API tests)
- Every edge case (too slow, too flaky)

## Fixing Flaky Tests

| Cause | Fix |
|-------|-----|
| Timing issues | Use auto-waiting, never `sleep` |
| Test data pollution | Isolate with fresh data per test |
| Animation interference | Disable CSS animations in test mode |
| Network variability | Mock external APIs, keep DB local |
| Parallel test conflicts | Unique users/data per worker |

## CI Integration

- Run E2E tests in a separate pipeline stage (after unit tests pass)
- Use Playwright's built-in parallelism (`--workers=4`)
- Capture screenshots and traces on failure
- Set a reasonable timeout (30s per test max)
- Retry flaky tests once before failing (`retries: 1`)

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Testing everything E2E | Only critical paths — unit test the rest |
| No test isolation | Each test creates its own data and cleans up |
| Brittle CSS selectors | Use roles, labels, test IDs |
| Ignoring flaky tests | Fix immediately — flaky tests erode trust |
| No failure artifacts | Always capture screenshots + traces on failure |

## Attribution

**Original** — Datatide, MIT licensed. See also [currents-dev/playwright-best-practices-skill](https://github.com/currents-dev/playwright-best-practices-skill) for Playwright-specific patterns.

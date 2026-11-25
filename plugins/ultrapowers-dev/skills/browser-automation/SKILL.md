---
name: browser-automation
description: Use when an AI agent needs to interact with websites — navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, or automating any browser task
---

# Browser Automation

## Overview

Give AI agents the ability to see and interact with the web. Choose the right tool based on your use case — quick tasks, testing, or programmatic automation.

## Tool Selection

| Tool | Best for | Install | Language |
|------|----------|---------|----------|
| **[agent-browser](https://github.com/vercel-labs/agent-browser)** (Vercel) | Agent tasks, form filling, scraping, screenshots | `npm i -g agent-browser` | CLI (any) |
| **[browser-use](https://github.com/browser-use/browser-use)** | Python agent workflows, complex multi-step automation | `pip install browser-use` | Python |
| **[Playwright](https://playwright.dev)** | E2E testing, CI/CD, deterministic test suites | `npm i -D @playwright/test` | JS/Python |

### Decision tree

```
Need to test UI in CI? → Playwright (see e2e-testing skill)
Need agent to browse/interact live? → agent-browser or browser-use
  Python project? → browser-use
  Any language / CLI? → agent-browser
```

## Core Workflow (All Tools)

Every browser automation follows the same pattern:

1. **Navigate** — open a URL
2. **Observe** — get page state (DOM snapshot, screenshot, element refs)
3. **Interact** — click, fill, select using element references
4. **Re-observe** — confirm the action worked
5. **Repeat** until task is complete

## agent-browser (Vercel) — Quick Reference

```bash
agent-browser open https://example.com
agent-browser snapshot -i          # Get element refs (@e1, @e2...)
agent-browser fill @e1 "text"      # Fill input
agent-browser click @e3            # Click button
agent-browser screenshot page.png  # Capture
```

**Auth:** Sign in through the site in a dedicated browser session for the task. Keep cookies and tokens in that session.

**Official skill:** Install `agent-browser` from [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) for full documentation.

## browser-use — Quick Reference

```bash
browser-use open https://example.com
browser-use state                  # Get clickable elements with indices
browser-use click 5                # Click element by index
browser-use input 3 "text"         # Fill input by index
browser-use screenshot page.png    # Capture
```

**Auth:** Use a dedicated browser profile for the task and sign in through the site as needed.

**Official skill:** Install `browser-use` from [browser-use/browser-use](https://github.com/browser-use/browser-use) for full documentation.

## Common Use Cases

| Use case | Recommended tool | Notes |
|----------|-----------------|-------|
| Fill out a web form | agent-browser | Snapshot → fill → click → verify |
| Scrape data from pages | agent-browser | Navigate → snapshot → extract text |
| E2E UI test suite | Playwright | Deterministic, CI-friendly (see `e2e-testing`) |
| Login and perform task | agent-browser/browser-use | Sign in through the site in a dedicated session, then automate |
| Monitor a dashboard | browser-use | Persistent sessions, screenshot on interval |
| Test across browsers | Playwright | Chromium, Firefox, WebKit |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Interacting before page loads | Always wait for network idle or specific element |
| Stale element references | Re-snapshot after any navigation or DOM change |
| Hardcoding selectors | Use tool's element indexing (refs/indices) over CSS selectors |
| No error recovery | Check state after each action, retry if needed |
| Running headed in CI | Use headless mode in pipelines |

## Attribution

**Original** — Datatide, MIT licensed. References [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) (Apache-2.0) and [browser-use/browser-use](https://github.com/browser-use/browser-use) (MIT).

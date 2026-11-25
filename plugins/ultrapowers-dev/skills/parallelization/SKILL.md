---
name: parallelization
description: "Use when the same input needs multiple independent analyses, or the same task should be run multiple times for voting or redundancy."
---

# Parallelization

Fan-out a task to multiple LLM calls running concurrently, then fan-in by aggregating, voting, or merging the results. This covers two main patterns: **sectioning** (different prompts, same input) and **voting** (same prompt, same input, multiple runs).

## When to Use

- **Sectioning**: the input needs analysis from multiple angles (e.g., sentiment + factuality + toxicity)
- **Voting**: you need higher reliability than a single call provides (e.g., content moderation, classification)
- **Batch processing**: many independent items need the same transformation

## When NOT to Use

- Steps are dependent on each other (use a chain or DAG)
- A single call is already reliable enough -- parallelization adds cost
- The aggregation logic is more complex than the task itself

## The Pattern

### Pseudocode (language-agnostic)

```
# Sectioning: different analysis on same input
function section(input, analyzers):
    tasks = [analyzer.call(input) for analyzer in analyzers]
    results = run_in_parallel(tasks)
    return aggregate(results)

# Voting: same analysis, multiple runs
function vote(input, prompt, n_votes):
    tasks = [llm.call(prompt, input) for _ in range(n_votes)]
    results = run_in_parallel(tasks)
    return majority_vote(results)
```

### Error Handling for Partial Failures

Not all parallel calls will succeed. Apply these strategies:

1. **Quorum** -- require M of N calls to succeed (e.g., 3 of 5 votes). If fewer succeed, report low confidence rather than failing.
2. **Retry with backoff** -- retry failed calls once with exponential backoff before giving up.
3. **Graceful degradation** -- in sectioning, return results from successful analyzers and note which ones failed.
4. **Timeout per call** -- set individual timeouts so one slow call does not block the entire fan-in.

### Rate Limiting

When fanning out to many concurrent calls:
- Use a semaphore to cap concurrency (e.g., max 10 concurrent API calls)
- Respect API rate limits -- batch into waves if needed
- Consider using smaller/faster models for voting tasks to reduce cost and latency

### Concrete Example (Python, Anthropic SDK)

```python
import anthropic
import asyncio

client = anthropic.AsyncAnthropic()
SEMAPHORE = asyncio.Semaphore(5)  # max 5 concurrent calls

async def analyze(system: str, text: str) -> str:
    async with SEMAPHORE:
        try:
            resp = await client.messages.create(
                model="claude-sonnet-4-20250514", max_tokens=512,
                system=system,
                messages=[{"role": "user", "content": text}],
            )
            return resp.content[0].text
        except Exception as e:
            return f"ERROR: {e}"

async def parallel_review(text: str) -> dict:
    analyzers = {
        "clarity": "Rate the clarity of this text from 1-10. Return JSON: {\"score\": N, \"reason\": \"...\"}",
        "accuracy": "Check factual accuracy. Return JSON: {\"issues\": [...], \"score\": N}",
        "tone": "Analyze the tone. Return JSON: {\"tone\": \"...\", \"appropriate\": true|false}",
    }

    tasks = {name: analyze(prompt, text) for name, prompt in analyzers.items()}
    results = {}
    for name, task in tasks.items():
        results[name] = await task

    # Filter out failures
    successes = {k: v for k, v in results.items() if not v.startswith("ERROR")}
    failures = {k: v for k, v in results.items() if v.startswith("ERROR")}

    return {"results": successes, "failures": failures}
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| One failed call causes total failure | Use quorum or graceful degradation; never require 100% success |
| Hitting API rate limits | Use a semaphore; batch into waves; consider cheaper models for voting |
| Voting on open-ended outputs (no clear majority) | Constrain outputs to categories or scores; use structured output schemas |
| Aggregation discards minority insights | In sectioning, preserve all results; in voting, log dissenting outputs for review |
| Cost blowup from too many parallel calls | Set a budget: N calls x cost-per-call. Use voting only where single-call reliability is genuinely insufficient |

## Key Insight

Parallelization multiplies cost linearly but can improve quality logarithmically -- use it surgically where reliability matters, not as a default.

## Attribution
**Original** -- Datatide, MIT licensed. Inspired by [Anthropic agent patterns documentation](https://docs.anthropic.com/en/docs/build-with-claude/agent-patterns).

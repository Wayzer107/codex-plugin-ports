---
name: orchestrator-workers
description: "Use when a complex task can be decomposed into subtasks that benefit from specialized prompts or models."
---

# Orchestrator-Workers

A central orchestrator analyzes the task, breaks it into subtasks, delegates each to a specialized worker, then synthesizes the results into a coherent output.

## When to Use

- The task naturally decomposes into **distinct subtasks** (e.g., "review this PR" = check logic + check style + check tests)
- Different subtasks benefit from **different system prompts, tools, or models**
- You need the decomposition to be **dynamic** -- the orchestrator decides the subtasks at runtime

## When NOT to Use

- The subtasks are fixed and known in advance (use a DAG workflow instead)
- A single prompt can handle the full task well enough
- Subtasks are tightly coupled and require shared mutable state

## The Pattern

### Pseudocode (language-agnostic)

```
function orchestrate(task):
    plan = orchestrator_llm.call(
        "Break this task into subtasks. Return JSON list.",
        task
    )

    results = {}
    for subtask in plan.subtasks:
        worker = select_worker(subtask.type)
        results[subtask.id] = worker.execute(subtask.instructions)

    synthesis = orchestrator_llm.call(
        "Synthesize these results into a final answer.",
        results
    )
    return synthesis
```

### Worker Selection Criteria

Choose workers based on these factors:

| Factor | Example |
|---|---|
| **Domain expertise** | Security review vs. performance review |
| **Tool access** | Worker with database access vs. worker with file system access |
| **Model tier** | Use a cheaper/faster model for simple extraction; a stronger model for reasoning |
| **Prompt specialization** | Each worker gets a focused system prompt with domain-specific instructions |

### Synthesis Quality

The synthesis step is where most orchestrator failures happen. Improve it by:

1. **Structured worker outputs** -- require workers to return results in a consistent format (JSON with `findings`, `confidence`, `evidence` fields).
2. **Conflict resolution** -- instruct the orchestrator to flag contradictions between workers.
3. **Weighted aggregation** -- let workers report confidence scores; the orchestrator weighs accordingly.

### Concrete Example (Python, Anthropic SDK)

```python
import anthropic

client = anthropic.Anthropic()

def call_worker(system_prompt: str, task: str) -> str:
    resp = client.messages.create(
        model="claude-sonnet-4-20250514", max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": task}],
    )
    return resp.content[0].text

# Orchestrator decomposes
plan_resp = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=2048,
    system="You decompose code review tasks. Return JSON: {\"subtasks\": [{\"type\": \"logic\"|\"style\"|\"security\", \"instructions\": \"...\"}]}",
    messages=[{"role": "user", "content": f"Review this diff:\n{diff}"}],
)
plan = json.loads(plan_resp.content[0].text)

# Dispatch to specialized workers
workers = {
    "logic": "You are a logic reviewer. Find bugs, edge cases, and incorrect assumptions.",
    "style": "You are a style reviewer. Check naming, formatting, and readability.",
    "security": "You are a security reviewer. Find injection, auth, and data exposure risks.",
}
results = {s["type"]: call_worker(workers[s["type"]], s["instructions"]) for s in plan["subtasks"]}

# Synthesize
final = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=2048,
    system="Combine these review findings into a single actionable review. Flag any contradictions.",
    messages=[{"role": "user", "content": json.dumps(results)}],
)
print(final.content[0].text)
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Orchestrator creates too many subtasks | Limit subtask count (3-7); instruct it to merge related work |
| Workers produce inconsistent output formats | Enforce a structured output schema for all workers |
| Synthesis drops important findings | Require the orchestrator to reference each worker's output explicitly |
| Single worker failure kills the pipeline | Catch errors per-worker; pass partial results to synthesis with notes on what failed |
| Overhead exceeds benefit for simple tasks | Add a pre-check: if the task is simple, skip orchestration and answer directly |

## Key Insight

The orchestrator pattern trades latency and cost for quality -- it only pays off when the task genuinely benefits from specialized perspectives that a single prompt cannot provide.

## Attribution
**Original** -- Datatide, MIT licensed. Inspired by [Anthropic agent patterns documentation](https://docs.anthropic.com/en/docs/build-with-claude/agent-patterns).

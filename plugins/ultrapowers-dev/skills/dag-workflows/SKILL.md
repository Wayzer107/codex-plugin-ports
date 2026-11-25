---
name: dag-workflows
description: "Use when a multi-step process has dependencies between steps, some of which can run in parallel, with shared state and conditional routing."
---

# DAG Workflows

A directed acyclic graph (DAG) defines steps as nodes and dependencies as edges. Steps run as soon as their dependencies are satisfied, enabling parallelism for independent branches. Shared state flows through the graph, and conditional routing skips branches that are not needed.

## When to Use

- Steps have **explicit dependencies** -- some must run before others, but not all are sequential
- Independent branches can **run in parallel** for speed
- You need **conditional routing** -- skip steps based on intermediate results
- The workflow is **known at design time** (not dynamically generated)

## When NOT to Use

- The number and type of steps are unknown until runtime (use orchestrator-workers or agent loop)
- All steps are sequential with no parallelism opportunity (use a simple chain)
- Steps need to loop or revisit earlier nodes (DAGs are acyclic by definition)

## The Pattern

### Pseudocode (language-agnostic)

```
dag = define_graph:
    A -> B, C          # B and C depend on A, can run in parallel
    B -> D
    C -> D             # D depends on both B and C
    D -> E (if condition) else F

state = {}

function execute_dag(dag, state):
    ready = nodes_with_no_unmet_dependencies(dag)

    while ready is not empty:
        results = run_in_parallel(ready, state)
        state.merge(results)

        for node in ready:
            mark_complete(node)

        ready = nodes_with_no_unmet_dependencies(dag)
        ready = filter_by_conditions(ready, state)

    return state
```

### Step Lifecycle: Prep / Exec / Post

Structure each node with three phases:

1. **Prep** -- validate inputs, fetch context from shared state, build the prompt
2. **Exec** -- call the LLM or tool
3. **Post** -- parse output, validate, write results to shared state

This separation makes nodes testable in isolation and keeps the DAG runner simple.

### Parallel Execution Guidance

- **Independent branches** -- nodes with no shared dependencies run concurrently (e.g., B and C above)
- **Rate limiting** -- cap concurrent LLM calls to avoid API throttling (use a semaphore or thread pool)
- **Failure isolation** -- if one parallel branch fails, decide whether to cancel siblings or let them complete
- **State locking** -- when parallel nodes write to shared state, use atomic updates or namespace by node ID

### Concrete Example (Python, Anthropic SDK)

```python
import anthropic
import asyncio

client = anthropic.AsyncAnthropic()

async def run_node(system: str, prompt: str) -> str:
    resp = await client.messages.create(
        model="claude-sonnet-4-20250514", max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text

async def run_dag(user_input: str):
    # Step A: analyze input
    analysis = await run_node("Classify the request.", user_input)

    # Steps B and C: run in parallel
    summary_task = run_node("Summarize the key points.", analysis)
    risk_task = run_node("Identify risks and concerns.", analysis)
    summary, risks = await asyncio.gather(summary_task, risk_task)

    # Step D: conditional routing
    if "high risk" in risks.lower():
        final = await run_node("Write a detailed risk mitigation plan.", f"Summary: {summary}\nRisks: {risks}")
    else:
        final = await run_node("Write a brief action plan.", f"Summary: {summary}\nRisks: {risks}")

    return final
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Cycle in the graph causes infinite execution | Validate the graph is acyclic at definition time (topological sort) |
| Parallel nodes write conflicting state | Namespace state keys by node ID or use immutable state passing |
| One slow node blocks the entire DAG | Add timeouts per node; allow partial completion with degraded output |
| Conditional routing logic becomes spaghetti | Keep conditions simple (one boolean per edge); complex logic belongs inside a node |
| Shared state grows unbounded | Prune intermediate results after downstream nodes consume them |

## Key Insight

DAG workflows give you the parallelism of fan-out with the control flow of a pipeline -- but only when the graph structure is known ahead of time.

## Attribution
**Original** -- Datatide, MIT licensed. Inspired by [Anthropic agent patterns documentation](https://docs.anthropic.com/en/docs/build-with-claude/agent-patterns).

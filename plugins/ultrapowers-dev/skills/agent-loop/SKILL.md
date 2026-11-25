---
name: agent-loop
description: "Use when a task requires autonomous multi-step reasoning with tool calls, where the number of steps is not known in advance."
---

# Agent Loop

An autonomous loop where the LLM repeatedly decides which tool to call, interprets results, and continues until the task is complete or a stop condition is met.

## When to Use

- The task requires **multiple tool calls** whose sequence cannot be predetermined
- Each step depends on the output of the previous step
- You need the model to decide when the task is "done"

## When NOT to Use

- The steps are fixed and known in advance (use a simple chain or DAG instead)
- The task can be solved in a single LLM call with no tools
- You need deterministic, auditable execution paths

## The Pattern

### Pseudocode (language-agnostic)

```
messages = [system_prompt, user_task]
tools = [list of tool definitions]

loop:
    response = llm.call(messages, tools)
    messages.append(response)

    if response.has_tool_calls:
        for call in response.tool_calls:
            result = execute_tool(call.name, call.arguments)
            messages.append(tool_result(call.id, result))
    else:
        break  # model produced a final text answer

    if len(messages) > CONTEXT_THRESHOLD:
        messages = summarize_and_compact(messages)

return response.text
```

### Context Window Management

The loop accumulates messages quickly. Apply these rules:

1. **Set a turn budget** -- cap iterations (e.g., 20) to prevent runaway loops.
2. **Summarize periodically** -- every N turns, ask the model to summarize progress so far, then replace old messages with the summary.
3. **Trim tool results** -- large tool outputs (file contents, API responses) should be truncated or summarized before appending.
4. **Track token usage** -- if approaching 80% of the context window, force a summarization pass.

### Concrete Example (Python, Anthropic SDK)

```python
import anthropic

client = anthropic.Anthropic()
tools = [{"name": "read_file", "description": "Read a file",
          "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}]

messages = [{"role": "user", "content": "Find the bug in main.py and explain it."}]

for _ in range(20):  # turn budget
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        tools=tools,
        messages=messages,
    )
    messages.append({"role": "assistant", "content": response.content})

    if response.stop_reason == "tool_use":
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = execute(block.name, block.input)  # your dispatch
                tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": result})
        messages.append({"role": "user", "content": tool_results})
    else:
        break

print(response.content[0].text)
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Infinite loops -- model keeps calling tools without converging | Set a hard turn budget and include "stop when done" in the system prompt |
| Context window overflow | Summarize history every N turns; truncate large tool outputs |
| Model forgets earlier findings | Include a running summary or scratchpad in the system prompt |
| Tool errors crash the loop | Wrap tool execution in try/catch; return error text to the model so it can adapt |
| Hallucinated tool names | Validate tool names against the registered list before execution |

## Key Insight

The agent loop's power comes from letting the model decide the next action, but its reliability comes from the guardrails you put around it -- turn budgets, context management, and error handling.

## Attribution
**Original** -- Datatide, MIT licensed. Inspired by [Anthropic agent patterns documentation](https://docs.anthropic.com/en/docs/build-with-claude/agent-patterns).

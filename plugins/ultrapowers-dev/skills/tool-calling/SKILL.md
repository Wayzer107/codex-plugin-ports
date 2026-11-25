---
name: tool-calling
description: "Use when an LLM needs to interact with external systems, APIs, or data sources through structured function calls."
---

# Tool Calling

The LLM receives a list of available tools with JSON schemas describing their inputs. When the model determines it needs external data or actions, it emits a structured tool call instead of plain text. Your code executes the tool and returns the result for the model to interpret.

## When to Use

- The model needs **real-time or external data** it cannot know from training (database queries, API calls, file reads)
- The task requires **actions with side effects** (sending emails, creating records, deploying code)
- You want **structured, validated inputs** rather than parsing free-text model output

## When NOT to Use

- The model can answer from its training knowledge alone
- You need the model to produce free-form output, not call functions
- The tools are so numerous (100+) that the model cannot reliably select among them

## The Pattern

### Pseudocode (language-agnostic)

```
tools = [
    {
        name: "get_weather",
        description: "Get current weather for a city",
        input_schema: {
            type: "object",
            properties: {city: {type: "string", description: "City name"}},
            required: ["city"]
        }
    }
]

response = llm.call(messages, tools)

if response.has_tool_calls:
    for call in response.tool_calls:
        validated_input = validate(call.arguments, tools[call.name].schema)
        result = execute(call.name, validated_input)
        messages.append(tool_result(call.id, result))
    response = llm.call(messages, tools)  # model interprets the result
```

### Tool Description Best Practices

The model selects tools based on descriptions. Write them well:

1. **Start with the verb** -- "Get", "Create", "Search", "Delete" -- not "This tool is used to..."
2. **State what it returns** -- "Returns a JSON object with temperature, humidity, and conditions"
3. **Include constraints** -- "Maximum 100 results per call" or "Requires admin permissions"
4. **Add examples in the description** -- "City name, e.g., 'San Francisco' or 'London, UK'"
5. **Avoid overlap** -- if two tools sound similar, clarify when to use each

### Schema Design Patterns

| Pattern | When to use | Example |
|---|---|---|
| **Required-only params** | Simple tools | `{city: string}` |
| **Optional with defaults** | Flexible tools | `{query: string, limit?: int = 10}` |
| **Enum constraints** | Restrict choices | `{status: "open" \| "closed"}` |
| **Nested objects** | Complex inputs | `{filter: {date_range: {start, end}}}` |
| **Descriptions on every field** | Always | `{query: {type: "string", description: "Search query, supports boolean operators"}}` |

### Concrete Example (Python, Anthropic SDK)

```python
import anthropic, json

client = anthropic.Anthropic()

tools = [{
    "name": "search_docs",
    "description": "Search internal documentation. Returns top matching snippets with page references.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query, e.g., 'authentication setup'"},
            "max_results": {"type": "integer", "description": "Max results to return (1-20)", "default": 5},
        },
        "required": ["query"],
    },
}]

def search_docs(query: str, max_results: int = 5) -> str:
    # Your actual search implementation
    return json.dumps([{"title": "Auth Guide", "snippet": "To set up auth...", "page": 12}])

messages = [{"role": "user", "content": "How do I set up authentication?"}]

response = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=1024, tools=tools, messages=messages,
)

# Handle tool calls
if response.stop_reason == "tool_use":
    for block in response.content:
        if block.type == "tool_use":
            result = search_docs(**block.input)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": block.id, "content": result}
            ]})

    # Model interprets the search results
    final = client.messages.create(
        model="claude-sonnet-4-20250514", max_tokens=1024, tools=tools, messages=messages,
    )
    print(final.content[0].text)
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Model picks the wrong tool | Improve tool descriptions; reduce overlap between similar tools |
| Model hallucinates tool arguments | Use strict JSON schemas with enums and constraints; validate before execution |
| Tool errors crash the application | Return errors as text to the model (not exceptions); let it retry or explain |
| Too many tools degrade selection accuracy | Group tools into categories; expose only relevant tools per context (max 10-20) |
| Tool descriptions are vague | Start with a verb, state return format, include an example value |
| Model calls tools unnecessarily | Add "Only use tools when you cannot answer from your knowledge" to the system prompt |

## Key Insight

Tool calling quality is 80% tool descriptions and schemas, 20% model capability -- invest in clear, unambiguous definitions before tuning anything else.

## Attribution
**Original** -- Datatide, MIT licensed. Inspired by [Anthropic agent patterns documentation](https://docs.anthropic.com/en/docs/build-with-claude/agent-patterns).

---
name: multi-agent-handoffs
description: "Use when a conversation spans multiple domains and should be routed between specialized agents based on context."
---

# Multi-Agent Handoffs

A router examines each user message and hands the conversation to the most appropriate specialized agent. The active agent handles the conversation until the topic shifts, then the router redirects. This is the pattern behind multi-department customer support, multi-skill assistants, and triage systems.

## When to Use

- The application covers **multiple distinct domains** (billing, technical support, sales)
- Each domain benefits from a **specialized system prompt, tools, or knowledge base**
- Users naturally shift between topics within a single conversation

## When NOT to Use

- A single system prompt handles all topics well enough
- Topics never overlap or shift mid-conversation
- You need sub-second latency (routing adds a classification step)

## The Pattern

### Pseudocode (language-agnostic)

```
agents = {
    "billing": {system_prompt: "...", tools: [...]},
    "technical": {system_prompt: "...", tools: [...]},
    "sales": {system_prompt: "...", tools: [...]},
}

current_agent = None
conversation_history = []
handoff_count = 0

loop:
    user_message = get_input()
    conversation_history.append(user_message)

    target = router.classify(user_message, current_agent, conversation_history)

    if target != current_agent:
        if handoff_count > MAX_HANDOFFS:
            target = "escalation"  # prevent loops
        summary = summarize_context(conversation_history)
        current_agent = target
        handoff_count += 1

    response = agents[current_agent].call(conversation_history)
    conversation_history.append(response)
```

### Context Preservation Strategies

When handing off between agents, context is often lost. Mitigate this:

1. **Full history passthrough** -- pass the entire conversation to the new agent. Simple but expensive for long conversations.
2. **Summarized handoff** -- summarize the conversation so far and pass it as a preamble to the new agent. Cheaper, but lossy.
3. **Structured handoff object** -- extract key facts (user name, account ID, issue description, steps taken) into a JSON object that accompanies every handoff.
4. **Hybrid** -- pass the structured object plus the last N messages for immediate context.

### Handoff Loop Prevention

Without guardrails, a router can bounce between agents indefinitely:

- **Max handoff count** -- after N handoffs (e.g., 5), escalate to a human or a generalist agent
- **Cooldown** -- once routed to an agent, require at least 2 user messages before allowing a re-route
- **Sticky routing** -- bias toward the current agent unless the classification confidence exceeds a threshold

### Concrete Example (Python, Anthropic SDK)

```python
import anthropic

client = anthropic.Anthropic()

agents = {
    "billing": "You are a billing specialist. Help with invoices, payments, and refunds.",
    "technical": "You are a technical support engineer. Help with bugs, setup, and configuration.",
    "general": "You are a general assistant. Handle greetings and unclear requests.",
}

def route(message: str, current: str | None) -> str:
    resp = client.messages.create(
        model="claude-haiku-3-20250317", max_tokens=50,
        system="Classify the user message into: billing, technical, or general. Return only the category name.",
        messages=[{"role": "user", "content": message}],
    )
    return resp.content[0].text.strip().lower()

def respond(agent_name: str, messages: list) -> str:
    resp = client.messages.create(
        model="claude-sonnet-4-20250514", max_tokens=1024,
        system=agents[agent_name],
        messages=messages,
    )
    return resp.content[0].text

# Conversation loop
current_agent = None
messages = []
handoffs = 0

while True:
    user_input = input("> ")
    messages.append({"role": "user", "content": user_input})

    target = route(user_input, current_agent)
    if target != current_agent and handoffs < 5:
        current_agent = target
        handoffs += 1

    reply = respond(current_agent, messages)
    messages.append({"role": "assistant", "content": reply})
    print(reply)
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Handoff loop between two agents | Set a max handoff count; add cooldown between re-routes |
| Context lost on handoff | Pass a structured handoff object with key facts; include last N messages |
| Router misclassifies ambiguous messages | Default to the current agent for ambiguous inputs (sticky routing) |
| Specialized agent receives off-topic questions | Include fallback instructions: "If this is outside your domain, say so" |
| Router adds noticeable latency | Use a fast/small model for routing (e.g., Haiku); cache common classifications |

## Key Insight

Handoff quality depends more on what context you transfer between agents than on how accurately you route -- invest in the handoff object, not just the classifier.

## Attribution
**Original** -- Datatide, MIT licensed. Inspired by [Anthropic agent patterns documentation](https://docs.anthropic.com/en/docs/build-with-claude/agent-patterns).

---
name: multi-agent-debate
description: "Use when a decision benefits from adversarial perspectives, where a single LLM call might be biased or miss edge cases."
---

# Multi-Agent Debate

Multiple LLM agents with distinct personas argue a question across multiple rounds. A judge agent evaluates the arguments and either declares convergence or triggers another round. This surfaces blind spots that a single perspective misses.

## When to Use

- **High-stakes decisions** where a wrong answer is costly (architecture choices, legal analysis, safety reviews)
- The question has **genuinely different valid perspectives** (trade-offs, not factual lookups)
- You suspect a single LLM call would exhibit **sycophancy or confirmation bias**

## When NOT to Use

- The question has a **clear factual answer** -- debate adds latency and cost for no gain
- You need **speed** -- debate requires 3+ sequential rounds minimum
- The personas are artificial and do not represent real disagreements (debate theater)

### Decision Tree

```
Is the answer objectively verifiable? --> YES --> Skip debate, use tool/retrieval
                                     --> NO  --> Are there genuine trade-offs?
                                                 --> YES --> Use debate
                                                 --> NO  --> Single call is fine
```

## The Pattern

### Pseudocode (language-agnostic)

```
agents = [
    {persona: "Advocate for approach A", system_prompt: "..."},
    {persona: "Advocate for approach B", system_prompt: "..."},
]
judge = {system_prompt: "Evaluate arguments. Declare winner or request another round."}

history = []
question = user_input

for round in range(MAX_ROUNDS):
    for agent in agents:
        argument = agent.call(question, history)
        history.append({agent: agent.persona, argument: argument})

    verdict = judge.call(history)

    if verdict.converged:
        return verdict.final_answer

    question = verdict.follow_up  # refine the question for next round

return judge.call(history, force_decision=True)
```

### Convergence Detection

Stop the debate when:

1. **Agreement** -- both agents reach the same conclusion (check with the judge)
2. **Diminishing returns** -- new arguments repeat earlier points (judge detects no novel content)
3. **Round budget exhausted** -- force a decision after MAX_ROUNDS (typically 3-5)
4. **Confidence threshold** -- the judge assigns a confidence score; stop when it exceeds a threshold

### Concrete Example (Python, Anthropic SDK)

```python
import anthropic, json

client = anthropic.Anthropic()

def call_agent(system: str, messages: list) -> str:
    resp = client.messages.create(
        model="claude-sonnet-4-20250514", max_tokens=1024,
        system=system, messages=messages,
    )
    return resp.content[0].text

personas = [
    "You advocate for microservices. Argue honestly but push for this approach.",
    "You advocate for a monolith. Argue honestly but push for this approach.",
]
judge_prompt = """Evaluate both arguments. Return JSON:
{"converged": bool, "winner": "A"|"B"|null, "reason": "...", "follow_up": "..."}"""

history = ""
question = "Should we split our Django app into microservices?"

for round in range(4):
    args = []
    for i, persona in enumerate(personas):
        arg = call_agent(persona, [{"role": "user", "content": f"Question: {question}\n\nDebate history:\n{history}"}])
        args.append(arg)
        history += f"\n--- Agent {chr(65+i)}, Round {round+1} ---\n{arg}"

    verdict = call_agent(judge_prompt, [{"role": "user", "content": history}])
    result = json.loads(verdict)

    if result["converged"]:
        print(f"Converged in round {round+1}: {result['reason']}")
        break
    question = result["follow_up"]
else:
    print(f"Forced decision after max rounds: {result['reason']}")
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Agents converge too quickly (agreeing to agree) | Give each agent a strong persona; instruct them to steelman their position |
| Debate never converges | Set a hard round limit (3-5); have the judge force a decision |
| Judge is biased toward one side | Use a neutral judge prompt; rotate judge persona or use a different model |
| Token cost explodes with full history | Summarize history between rounds; only pass the latest arguments plus a summary |
| Debate on factual questions wastes tokens | Pre-screen: if the question is verifiable, skip debate entirely |

## Key Insight

Debate is most valuable when the cost of a wrong decision exceeds the cost of 3-5 extra LLM calls -- use it for architecture, strategy, and safety, not for routine tasks.

## Attribution
**Original** -- Datatide, MIT licensed. Inspired by [Anthropic agent patterns documentation](https://docs.anthropic.com/en/docs/build-with-claude/agent-patterns).

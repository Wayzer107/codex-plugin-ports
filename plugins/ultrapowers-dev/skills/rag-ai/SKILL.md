---
name: rag-ai
description: "Use when building retrieval-augmented generation pipelines — covering chunking, embeddings, vector search, and reranking for grounded LLM responses."
---

# RAG & AI Retrieval

Retrieval-Augmented Generation grounds LLM outputs in your own data. Instead of relying on the model's training data, you retrieve relevant context at query time and feed it into the prompt.

## When to Use

- LLM needs access to private, proprietary, or frequently updated data
- Answers must be grounded in source documents (reduces hallucination)
- Fine-tuning is too expensive or your data changes often
- Building Q&A, search, or knowledge assistant features

## RAG vs Fine-Tuning

| Factor | RAG | Fine-Tuning |
|--------|-----|-------------|
| Data freshness | Real-time; update index anytime | Stale until retrained |
| Cost | Cheaper; no training compute | Expensive training runs |
| Traceability | Can cite source documents | No built-in attribution |
| Best for | Factual recall, domain knowledge | Style, tone, format, reasoning patterns |

**Default to RAG.** Fine-tune only when you need to change *how* the model responds, not *what* it knows.

## Pipeline Architecture

```
Query --> Embed Query --> Vector Search --> Rerank --> Build Prompt --> LLM --> Response
                              |
                    Document Index (pre-built)
                              |
            Ingest --> Chunk --> Embed Chunks --> Store
```

## Chunking Strategies

| Strategy | Best For | Typical Size |
|----------|----------|-------------|
| **Fixed-size** | Uniform documents, simple setup | 256-512 tokens with 10-20% overlap |
| **Semantic** | Mixed-format documents | Split on paragraph/section boundaries |
| **Recursive** | Hierarchical content | Split by heading, then paragraph, then sentence |
| **Document-aware** | Structured formats (Markdown, HTML, code) | Respect structural boundaries (functions, sections) |

**Rules:** Always include overlap between chunks (10-20%). Smaller chunks improve precision; larger chunks preserve context. Test chunk sizes empirically.

## Embedding Selection

| Consideration | Guideline |
|--------------|-----------|
| Dimensionality | 256-1536 dims; higher is not always better |
| Model match | Use the same model for queries and documents |
| Domain fit | General-purpose models work for most cases; fine-tuned embeddings for specialized domains |
| Benchmarking | Evaluate on your actual queries, not public benchmarks |

## Reranking

Vector similarity retrieves candidates (high recall). A reranker scores and reorders them (high precision).

- Retrieve top 20-50 candidates via vector search
- Rerank to top 3-5 using a cross-encoder or LLM-based reranker
- Reranking adds latency but significantly improves answer quality

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Chunks too large (>1000 tokens) | Smaller chunks with overlap improve retrieval precision |
| No overlap between chunks | Add 10-20% overlap to avoid splitting key information |
| Skipping reranking | Even a simple reranker measurably improves relevance |
| Ignoring retrieval evaluation | Measure recall@k and precision@k on representative queries |
| Stuffing too many chunks in prompt | Limit to 3-5 most relevant chunks; more context can confuse the LLM |

## Attribution
**Original** — Datatide, MIT licensed.

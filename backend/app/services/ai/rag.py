import logging
import time
from collections.abc import AsyncGenerator
from dataclasses import asdict
from datetime import datetime, timezone

from app.services.ai import chunking, embeddings, llm, vectorstore, web_search
from app.services.cache import get_cached, make_cache_key, set_cached
from app.core.config import get_settings

logger = logging.getLogger("stacksense")
settings = get_settings()


async def ingest_document(
    text: str,
    source: str = "upload",
    metadata: dict | None = None,
) -> dict:
    """Chunk text, embed, and store in Qdrant."""
    chunks = chunking.chunk_text(text)
    if not chunks:
        return {"chunks": 0, "point_ids": []}

    vecs = await embeddings.embed_texts(chunks)

    base_meta = {
        "source": source,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        **(metadata or {}),
    }
    meta_list = [{**base_meta, "chunk_index": i} for i in range(len(chunks))]

    point_ids = await vectorstore.upsert_vectors(vecs, chunks, meta_list)

    logger.info("Ingested %d chunks from source=%s", len(chunks), source)
    return {"chunks": len(chunks), "point_ids": point_ids}


async def query(
    question: str,
    top_k: int | None = None,
    tone: str = "technical",
) -> dict:
    """Full RAG: embed query -> retrieve -> generate -> return."""
    cache_key = make_cache_key("rag_query", question=question, top_k=top_k or settings.RAG_TOP_K)
    cached = await get_cached(cache_key)
    if cached:
        logger.info("RAG cache hit for query")
        return cached

    start = time.monotonic()
    query_vec = await embeddings.embed_query(question)
    results = await vectorstore.search_vectors(query_vec, top_k=top_k)

    # Web search fallback when document results are weak
    used_web = False
    if web_search.should_fallback(results):
        web_results = await web_search.search(question)
        if web_results:
            results = web_results
            used_web = True
            logger.info("Falling back to web search for query")

    context = _build_context(results)
    answer, usage = await llm.generate(question, context, tone=tone)
    elapsed = round((time.monotonic() - start) * 1000)

    response = {
        "answer": answer,
        "sources": results,
        "insights": {
            "latency_ms": elapsed,
            "retrieval_count": len(results),
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "total_tokens": usage.total_tokens,
            "model": settings.GROQ_MODEL,
            "web_search": used_web,
        },
    }

    await set_cached(cache_key, response, ttl=settings.RAG_CACHE_TTL)
    return response


async def query_stream(
    question: str,
    top_k: int | None = None,
    system_prompt: str | None = None,
    tone: str = "technical",
) -> AsyncGenerator[dict, None]:
    """RAG with streaming response — yields event dicts."""
    start = time.monotonic()
    query_vec = await embeddings.embed_query(question)
    results = await vectorstore.search_vectors(query_vec, top_k=top_k)
    retrieval_ms = round((time.monotonic() - start) * 1000)

    # Web search fallback when document results are weak
    used_web = False
    if web_search.should_fallback(results):
        web_results = await web_search.search(question)
        if web_results:
            results = web_results
            used_web = True
            retrieval_ms = round((time.monotonic() - start) * 1000)
            logger.info("Stream: falling back to web search")

    context = _build_context(results)

    # Emit sources event first
    yield {
        "type": "sources",
        "sources": results,
        "retrieval_count": len(results),
        "retrieval_ms": retrieval_ms,
        "web_search": used_web,
    }

    # Stream tokens
    async for token, stream_result in llm.generate_stream(question, context, system_prompt, tone=tone):
        if token:
            yield {"type": "token", "token": token}
        if stream_result:
            yield {
                "type": "insights",
                "latency_ms": stream_result.latency_ms + retrieval_ms,
                "retrieval_count": len(results),
                "retrieval_ms": retrieval_ms,
                "generation_ms": stream_result.latency_ms,
                "prompt_tokens": stream_result.usage.prompt_tokens,
                "completion_tokens": stream_result.usage.completion_tokens,
                "total_tokens": stream_result.usage.total_tokens,
                "model": stream_result.model,
            }

    yield {"type": "done"}


async def query_stream_multistep(
    question: str,
    steps: list[str],
    top_k: int | None = None,
) -> AsyncGenerator[dict, None]:
    """Multi-step workflow: runs steps sequentially, streaming each."""
    start = time.monotonic()
    query_vec = await embeddings.embed_query(question)
    results = await vectorstore.search_vectors(query_vec, top_k=top_k)
    context = _build_context(results)

    yield {
        "type": "sources",
        "sources": results,
        "retrieval_count": len(results),
        "retrieval_ms": round((time.monotonic() - start) * 1000),
    }

    accumulated = question
    total_tokens = 0

    for i, step in enumerate(steps):
        prompt_template = llm.WORKFLOW_PROMPTS.get(step, "{input}")
        user_input = prompt_template.format(input=accumulated)

        yield {"type": "step_start", "step": step, "step_index": i, "total_steps": len(steps)}

        step_content = ""
        async for token, stream_result in llm.generate_stream(user_input, context):
            if token:
                yield {"type": "token", "token": token, "step": step}
                step_content += token
            if stream_result:
                total_tokens += stream_result.usage.total_tokens

        yield {"type": "step_end", "step": step, "step_index": i}
        accumulated = step_content

    elapsed = round((time.monotonic() - start) * 1000)
    yield {
        "type": "insights",
        "latency_ms": elapsed,
        "retrieval_count": len(results),
        "total_tokens": total_tokens,
        "model": settings.GROQ_MODEL,
        "workflow_steps": steps,
    }
    yield {"type": "done"}


async def root_cause_analysis(
    logs: str,
    top_k: int | None = None,
) -> AsyncGenerator[dict, None]:
    """Root cause analysis on logs/errors with pattern detection."""
    start = time.monotonic()

    # Try to find relevant context from knowledge base
    query_vec = await embeddings.embed_query(logs[:500])
    results = await vectorstore.search_vectors(query_vec, top_k=top_k)
    context = _build_context(results)

    yield {
        "type": "sources",
        "sources": results,
        "retrieval_count": len(results),
        "retrieval_ms": round((time.monotonic() - start) * 1000),
    }

    yield {"type": "step_start", "step": "analyzing", "step_index": 0, "total_steps": 1}

    async for token, stream_result in llm.generate_stream(
        logs, context, system_prompt=llm.RCA_SYSTEM_PROMPT
    ):
        if token:
            yield {"type": "token", "token": token}
        if stream_result:
            yield {
                "type": "insights",
                "latency_ms": stream_result.latency_ms + round((time.monotonic() - start) * 1000),
                "retrieval_count": len(results),
                "prompt_tokens": stream_result.usage.prompt_tokens,
                "completion_tokens": stream_result.usage.completion_tokens,
                "total_tokens": stream_result.usage.total_tokens,
                "model": stream_result.model,
            }

    yield {"type": "step_end", "step": "analyzing", "step_index": 0}
    yield {"type": "done"}


def _build_context(results: list[dict]) -> str:
    """Format retrieved chunks into a context block for the LLM."""
    if not results:
        return "No relevant context found."

    parts = []
    for i, r in enumerate(results, 1):
        source = r["metadata"].get("source", "unknown")
        parts.append(f"[{i}] (source: {source}, score: {r['score']:.3f})\n{r['text']}")
    return "\n\n".join(parts)


async def list_documents(
    source: str | None = None,
    limit: int = 20,
    offset: str | None = None,
) -> dict:
    """List ingested documents/chunks with optional source filter."""
    points, next_offset = await vectorstore.scroll_vectors(
        source=source, limit=limit, offset=offset,
    )
    total = await vectorstore.count_vectors()
    return {
        "documents": points,
        "total": total,
        "next_offset": next_offset,
    }


async def delete_document(point_ids: list[str]) -> dict:
    """Delete documents by their vector IDs."""
    await vectorstore.delete_vectors(point_ids)
    logger.info("Deleted %d vectors", len(point_ids))
    return {"deleted": len(point_ids)}


async def get_collection_stats() -> dict:
    """Return vector collection statistics."""
    return await vectorstore.collection_info()

"""Tavily web search fallback — gated behind WEB_SEARCH_ENABLED feature flag."""

import logging

from tavily import AsyncTavilyClient

from app.core.config import get_settings

logger = logging.getLogger("stacksense")
settings = get_settings()

_client: AsyncTavilyClient | None = None


def _get_client() -> AsyncTavilyClient:
    global _client
    if _client is None:
        if not settings.TAVILY_API_KEY:
            raise RuntimeError("TAVILY_API_KEY is not set but WEB_SEARCH_ENABLED is True")
        _client = AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
    return _client


def is_enabled() -> bool:
    return settings.WEB_SEARCH_ENABLED and bool(settings.TAVILY_API_KEY)


def should_fallback(results: list[dict], threshold: float | None = None) -> bool:
    """Return True when Qdrant results are empty or all below score threshold."""
    if not is_enabled():
        return False
    if not results:
        return True
    thr = threshold or settings.WEB_SEARCH_SCORE_THRESHOLD
    return all(r.get("score", 0) < thr for r in results)


async def search(query: str, max_results: int | None = None) -> list[dict]:
    """Search the web via Tavily and return results in the same shape as Qdrant results.

    Returns list of dicts with keys: text, score, metadata.
    """
    if not is_enabled():
        return []

    client = _get_client()
    n = max_results or settings.WEB_SEARCH_MAX_RESULTS

    try:
        response = await client.search(
            query=query,
            max_results=n,
            search_depth="basic",
            include_answer=False,
        )
    except Exception:
        logger.exception("Tavily web search failed")
        return []

    results = []
    for item in response.get("results", []):
        results.append({
            "text": item.get("content", ""),
            "score": item.get("score", 0.5),
            "metadata": {
                "source": item.get("url", "web"),
                "title": item.get("title", ""),
                "source_type": "web",
            },
        })

    logger.info("Web search returned %d results for query: %s", len(results), query[:80])
    return results

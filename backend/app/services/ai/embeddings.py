import logging

import cohere

from app.core.config import get_settings

logger = logging.getLogger("stacksense")
settings = get_settings()

_client: cohere.AsyncClientV2 | None = None


def _get_client() -> cohere.AsyncClientV2:
    global _client
    if _client is None:
        _client = cohere.AsyncClientV2(api_key=settings.COHERE_API_KEY)
    return _client


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts using Cohere."""
    client = _get_client()
    response = await client.embed(
        texts=texts,
        model=settings.COHERE_MODEL,
        input_type="search_document",
        embedding_types=["float"],
    )
    return [list(e) for e in response.embeddings.float_]


async def embed_query(query: str) -> list[float]:
    """Generate embedding for a single query (uses search_query input type)."""
    client = _get_client()
    response = await client.embed(
        texts=[query],
        model=settings.COHERE_MODEL,
        input_type="search_query",
        embedding_types=["float"],
    )
    return list(response.embeddings.float_[0])

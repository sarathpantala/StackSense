import logging
import uuid

from qdrant_client import AsyncQdrantClient, models

from app.core.config import get_settings

logger = logging.getLogger("stacksense")
settings = get_settings()

_client: AsyncQdrantClient | None = None


async def _get_client() -> AsyncQdrantClient:
    global _client
    if _client is None:
        _client = AsyncQdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY or None,
        )
    return _client


async def ensure_collection() -> None:
    """Create collection if it doesn't exist."""
    client = await _get_client()
    collections = await client.get_collections()
    names = [c.name for c in collections.collections]

    if settings.QDRANT_COLLECTION not in names:
        await client.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=models.VectorParams(
                size=settings.COHERE_EMBEDDING_DIM,
                distance=models.Distance.COSINE,
            ),
        )
        logger.info("Created Qdrant collection: %s", settings.QDRANT_COLLECTION)


async def upsert_vectors(
    embeddings: list[list[float]],
    texts: list[str],
    metadata: list[dict],
) -> list[str]:
    """Store embeddings with text payloads in Qdrant. Returns point IDs."""
    client = await _get_client()
    await ensure_collection()

    point_ids = [str(uuid.uuid4()) for _ in embeddings]

    points = [
        models.PointStruct(
            id=pid,
            vector=emb,
            payload={"text": text, **meta},
        )
        for pid, emb, text, meta in zip(point_ids, embeddings, texts, metadata)
    ]

    await client.upsert(
        collection_name=settings.QDRANT_COLLECTION,
        points=points,
    )
    logger.info("Upserted %d vectors into Qdrant", len(points))
    return point_ids


async def search_vectors(
    query_embedding: list[float],
    top_k: int | None = None,
) -> list[dict]:
    """Search for similar vectors. Returns list of {text, score, metadata}."""
    client = await _get_client()
    k = top_k or settings.RAG_TOP_K

    results = await client.query_points(
        collection_name=settings.QDRANT_COLLECTION,
        query=query_embedding,
        limit=k,
        with_payload=True,
    )

    return [
        {
            "id": str(point.id),
            "text": point.payload.get("text", ""),
            "score": point.score,
            "metadata": {
                k: v for k, v in point.payload.items() if k != "text"
            },
        }
        for point in results.points
    ]


async def delete_vectors(point_ids: list[str]) -> None:
    """Delete vectors by their IDs."""
    client = await _get_client()
    await client.delete(
        collection_name=settings.QDRANT_COLLECTION,
        points_selector=models.PointIdsList(points=point_ids),
    )


async def count_vectors() -> int:
    """Return total number of vectors in the collection."""
    client = await _get_client()
    await ensure_collection()
    info = await client.get_collection(settings.QDRANT_COLLECTION)
    return info.points_count or 0


async def scroll_vectors(
    source: str | None = None,
    limit: int = 20,
    offset: str | None = None,
) -> tuple[list[dict], str | None]:
    """List stored documents with optional source filter.

    Returns (points, next_offset) for pagination.
    """
    client = await _get_client()
    await ensure_collection()

    scroll_filter = None
    if source:
        scroll_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="source",
                    match=models.MatchValue(value=source),
                )
            ]
        )

    results, next_offset = await client.scroll(
        collection_name=settings.QDRANT_COLLECTION,
        scroll_filter=scroll_filter,
        limit=limit,
        offset=offset,
        with_payload=True,
        with_vectors=False,
    )

    points = [
        {
            "id": str(point.id),
            "text": point.payload.get("text", ""),
            "metadata": {k: v for k, v in point.payload.items() if k != "text"},
        }
        for point in results
    ]

    return points, str(next_offset) if next_offset else None


async def collection_info() -> dict:
    """Return collection stats."""
    client = await _get_client()
    await ensure_collection()
    info = await client.get_collection(settings.QDRANT_COLLECTION)
    return {
        "collection": settings.QDRANT_COLLECTION,
        "vectors_count": info.points_count or 0,
        "status": str(info.status),
    }


async def close_client() -> None:
    global _client
    if _client:
        await _client.close()
        _client = None

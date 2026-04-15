import hashlib
import json
from typing import Any

from app.services.redis import get_redis


async def get_cached(key: str) -> Any | None:
    """Retrieve a cached value by key."""
    redis_client = await get_redis()
    data = await redis_client.get(f"cache:{key}")
    if data is not None:
        return json.loads(data)
    return None


async def set_cached(key: str, value: Any, ttl: int = 300) -> None:
    """Cache a value with a TTL (default 5 minutes)."""
    redis_client = await get_redis()
    await redis_client.set(f"cache:{key}", json.dumps(value), ex=ttl)


async def invalidate_cache(key: str) -> None:
    """Delete a cached value."""
    redis_client = await get_redis()
    await redis_client.delete(f"cache:{key}")


def make_cache_key(prefix: str, **kwargs) -> str:
    """Generate a deterministic cache key from prefix and keyword arguments."""
    raw = json.dumps(kwargs, sort_keys=True, default=str)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"{prefix}:{digest}"

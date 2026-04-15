from fastapi import Request

from app.core.config import get_settings
from app.core.exceptions import RateLimitError
from app.services.redis import get_redis

settings = get_settings()


async def check_rate_limit(
    request: Request,
    max_requests: int | None = None,
    window_seconds: int | None = None,
    key_prefix: str = "rate_limit",
) -> None:
    """Check rate limit for the request based on client IP."""
    limit = max_requests or settings.RATE_LIMIT_REQUESTS
    window = window_seconds or settings.RATE_LIMIT_WINDOW_SECONDS
    client_ip = request.client.host if request.client else "unknown"
    redis_client = await get_redis()

    key = f"{key_prefix}:{client_ip}"
    current = await redis_client.get(key)

    if current is not None and int(current) >= limit:
        raise RateLimitError()

    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, window)
    await pipe.execute()


async def check_auth_rate_limit(request: Request) -> None:
    """Stricter rate limit for auth endpoints (login/signup)."""
    await check_rate_limit(
        request,
        max_requests=settings.AUTH_RATE_LIMIT_REQUESTS,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        key_prefix="auth_rate_limit",
    )

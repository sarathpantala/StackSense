import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import async_session_factory
from app.services.redis import get_redis

logger = logging.getLogger("stacksense")
router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    checks = {"status": "healthy", "postgres": "ok", "redis": "ok"}

    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Health check: Postgres unreachable — %s", exc)
        checks["postgres"] = "unavailable"
        checks["status"] = "degraded"

    try:
        redis_client = await get_redis()
        await redis_client.ping()
    except Exception as exc:
        logger.error("Health check: Redis unreachable — %s", exc)
        checks["redis"] = "unavailable"
        checks["status"] = "degraded"

    return checks

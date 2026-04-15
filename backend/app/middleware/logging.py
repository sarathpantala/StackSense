import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("stacksense")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start_time = time.perf_counter()

        logger.info(
            "request_start | id=%s method=%s path=%s client=%s",
            request_id,
            request.method,
            request.url.path,
            request.client.host if request.client else "unknown",
        )

        response = await call_next(request)

        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "request_end | id=%s status=%d duration=%.2fms",
            request_id,
            response.status_code,
            duration_ms,
        )

        response.headers["X-Request-ID"] = request_id
        return response

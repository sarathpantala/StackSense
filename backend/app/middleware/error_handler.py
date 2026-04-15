import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.exceptions import AppException

logger = logging.getLogger("stacksense")


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = getattr(request.state, "request_id", "unknown")
        try:
            return await call_next(request)
        except AppException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail, "request_id": request_id},
            )
        except Exception as exc:
            logger.exception(
                "unhandled_error | id=%s path=%s error=%s",
                request_id,
                request.url.path,
                str(exc),
            )
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
            )

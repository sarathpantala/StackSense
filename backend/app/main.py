import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import router as v1_router
from app.core.config import get_settings
from app.core.exceptions import AppException
from app.middleware.error_handler import ErrorHandlerMiddleware
from app.middleware.logging import LoggingMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.services.rate_limiter import check_rate_limit
from app.services.redis import close_redis
from app.services.ai.vectorstore import close_client as close_qdrant
from app.services.telemetry import setup_telemetry

settings = get_settings()

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("stacksense")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s (%s)", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)
    yield
    await close_redis()
    await close_qdrant()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# --- Exception handler for AppException raised outside middleware ---
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

# --- Middleware (order matters: last added = first executed) ---
app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Request-ID"],
    max_age=settings.CORS_MAX_AGE,
)


# --- Rate Limiting ---
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if not request.url.path.endswith("/health"):
        await check_rate_limit(request)
    return await call_next(request)


# --- Routes ---
app.include_router(v1_router)

# --- OpenTelemetry ---
setup_telemetry(app)

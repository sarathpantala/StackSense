from pydantic import model_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "StackSense"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # Postgres
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/stacksense"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    AUTH_RATE_LIMIT_REQUESTS: int = 10
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 300

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    CORS_MAX_AGE: int = 600

    # OpenTelemetry
    OTEL_ENABLED: bool = False
    OTEL_SERVICE_NAME: str = "stacksense-backend"
    OTEL_EXPORTER_ENDPOINT: str = "http://localhost:4317"

    # Groq LLM
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama3-70b-8192"
    GROQ_MAX_TOKENS: int = 4096
    GROQ_TEMPERATURE: float = 0.1

    # Cohere Embeddings
    COHERE_API_KEY: str = ""
    COHERE_MODEL: str = "embed-english-v3.0"
    COHERE_EMBEDDING_DIM: int = 1024

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str | None = None
    QDRANT_COLLECTION: str = "stacksense_docs"

    # RAG
    RAG_CHUNK_SIZE: int = 512
    RAG_CHUNK_OVERLAP: int = 50
    RAG_TOP_K: int = 5
    RAG_CACHE_TTL: int = 600

    # Web Search (Tavily) — feature flag
    WEB_SEARCH_ENABLED: bool = False
    TAVILY_API_KEY: str = ""
    WEB_SEARCH_MAX_RESULTS: int = 5
    WEB_SEARCH_SCORE_THRESHOLD: float = 0.3  # fallback when all Qdrant scores below this

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def _validate_secrets(self):
        if not self.JWT_SECRET_KEY:
            raise ValueError(
                "JWT_SECRET_KEY must be set. Generate one with: "
                "python -c 'import secrets; print(secrets.token_urlsafe(64))'"
            )
        if len(self.JWT_SECRET_KEY) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

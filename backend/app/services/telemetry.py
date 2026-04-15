import logging

from app.core.config import get_settings

logger = logging.getLogger("stacksense")
settings = get_settings()


def setup_telemetry(app) -> None:
    """Initialize OpenTelemetry tracing if enabled."""
    if not settings.OTEL_ENABLED:
        logger.info("OpenTelemetry disabled, skipping setup")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.instrumentation.redis import RedisInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        resource = Resource.create({"service.name": settings.OTEL_SERVICE_NAME})
        provider = TracerProvider(resource=resource)

        exporter = OTLPSpanExporter(endpoint=settings.OTEL_EXPORTER_ENDPOINT)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        FastAPIInstrumentor.instrument_app(app)
        SQLAlchemyInstrumentor().instrument()
        RedisInstrumentor().instrument()

        logger.info("OpenTelemetry tracing initialized")
    except ImportError:
        logger.warning(
            "OpenTelemetry packages not installed. Install with: "
            "pip install opentelemetry-api opentelemetry-sdk "
            "opentelemetry-instrumentation-fastapi "
            "opentelemetry-instrumentation-sqlalchemy "
            "opentelemetry-instrumentation-redis "
            "opentelemetry-exporter-otlp-proto-grpc"
        )

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Tone(str, Enum):
    simple = "simple"
    technical = "technical"
    expert = "expert"


class IngestTextRequest(BaseModel):
    text: str = Field(..., min_length=1)
    source: str = "upload"
    metadata: dict | None = None


class IngestResponse(BaseModel):
    chunks: int
    point_ids: list[str]


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    top_k: int | None = Field(None, ge=1, le=20)
    tone: Tone = Tone.technical


class QueryInsights(BaseModel):
    latency_ms: int = 0
    retrieval_count: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    model: str = ""


class SourceChunk(BaseModel):
    id: str
    text: str
    score: float
    metadata: dict


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    insights: QueryInsights | None = None


class WorkflowRequest(BaseModel):
    question: str = Field(..., min_length=1)
    steps: list[str] = Field(
        default=["analyze", "summarize", "recommend"],
        min_length=1,
        max_length=5,
    )
    top_k: int | None = Field(None, ge=1, le=20)


class RCARequest(BaseModel):
    logs: str = Field(..., min_length=1, max_length=50000)
    top_k: int | None = Field(None, ge=1, le=20)


class CommandRequest(BaseModel):
    command: str = Field(..., pattern=r"^(debug|analyze|explain|generate-fix|search)$")
    input: str = Field(..., min_length=1)
    top_k: int | None = Field(None, ge=1, le=20)


class UserMemoryEntry(BaseModel):
    query: str
    summary: str | None = None
    tags: list[str] = []


class DocumentItem(BaseModel):
    id: str
    text: str
    metadata: dict


class DocumentListResponse(BaseModel):
    documents: list[DocumentItem]
    total: int
    next_offset: str | None = None


class DeleteRequest(BaseModel):
    point_ids: list[str] = Field(..., min_length=1, max_length=100)


class DeleteResponse(BaseModel):
    deleted: int


class CollectionStatsResponse(BaseModel):
    collection: str
    vectors_count: int
    status: str

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUser
from app.api.v1.schemas.rag import (
    CollectionStatsResponse,
    CommandRequest,
    DeleteRequest,
    DeleteResponse,
    DocumentListResponse,
    IngestResponse,
    IngestTextRequest,
    QueryRequest,
    QueryResponse,
    RCARequest,
    WorkflowRequest,
)
from app.services.ai import llm, rag

logger = logging.getLogger("stacksense")
router = APIRouter(prefix="/rag", tags=["rag"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/ingest/text", response_model=IngestResponse)
async def ingest_text(body: IngestTextRequest, _user: CurrentUser):
    result = await rag.ingest_document(
        text=body.text,
        source=body.source,
        metadata=body.metadata,
    )
    return result


@router.post("/ingest/file", response_model=IngestResponse)
async def ingest_file(file: UploadFile, _user: CurrentUser):
    if file.content_type not in ("text/plain", "text/markdown", "text/csv"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Use text/plain, text/markdown, or text/csv.",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 10 MB limit.",
        )

    text = content.decode("utf-8")
    result = await rag.ingest_document(
        text=text,
        source=file.filename or "file_upload",
        metadata={"content_type": file.content_type, "filename": file.filename},
    )
    return result


@router.post("/query", response_model=QueryResponse)
async def query_rag(body: QueryRequest, _user: CurrentUser):
    result = await rag.query(question=body.question, top_k=body.top_k, tone=body.tone.value)
    return result


@router.post("/query/stream")
async def query_rag_stream(body: QueryRequest, _user: CurrentUser):
    async def event_generator():
        async for event in rag.query_stream(question=body.question, top_k=body.top_k, tone=body.tone.value):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/command/stream")
async def command_stream(body: CommandRequest, _user: CurrentUser):
    """Execute a slash command with streaming response."""
    prompt_template = llm.COMMAND_PROMPTS.get(body.command)
    if not prompt_template:
        raise HTTPException(status_code=400, detail=f"Unknown command: {body.command}")

    user_input = prompt_template.format(input=body.input)

    async def event_generator():
        async for event in rag.query_stream(
            question=user_input,
            top_k=body.top_k,
            system_prompt=None,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/workflow/stream")
async def workflow_stream(body: WorkflowRequest, _user: CurrentUser):
    """Execute a multi-step workflow with streaming response."""
    valid_steps = set(llm.WORKFLOW_PROMPTS.keys())
    for step in body.steps:
        if step not in valid_steps:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid workflow step: {step}. Valid steps: {sorted(valid_steps)}",
            )

    async def event_generator():
        async for event in rag.query_stream_multistep(
            question=body.question,
            steps=body.steps,
            top_k=body.top_k,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/rca/stream")
async def rca_stream(body: RCARequest, _user: CurrentUser):
    """Root cause analysis on logs/errors with streaming response."""
    async def event_generator():
        async for event in rag.root_cause_analysis(
            logs=body.logs,
            top_k=body.top_k,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    _user: CurrentUser,
    source: str | None = None,
    limit: int = 20,
    offset: str | None = None,
):
    """List ingested document chunks with optional source filter and pagination."""
    result = await rag.list_documents(source=source, limit=min(limit, 100), offset=offset)
    return result


@router.delete("/documents", response_model=DeleteResponse)
async def delete_documents(body: DeleteRequest, _user: CurrentUser):
    """Delete document chunks by their vector IDs."""
    result = await rag.delete_document(body.point_ids)
    return result


@router.get("/stats", response_model=CollectionStatsResponse)
async def collection_stats(_user: CurrentUser):
    """Return vector collection statistics."""
    return await rag.get_collection_stats()

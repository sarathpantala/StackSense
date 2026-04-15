from app.core.config import get_settings

settings = get_settings()


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[str]:
    """Split text into overlapping chunks by character count, respecting word boundaries."""
    size = chunk_size or settings.RAG_CHUNK_SIZE
    lap = overlap or settings.RAG_CHUNK_OVERLAP

    text = text.strip()
    if not text:
        return []

    if len(text) <= size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + size

        # Try to break at a word boundary
        if end < len(text):
            boundary = text.rfind(" ", start, end)
            if boundary > start:
                end = boundary

        chunks.append(text[start:end].strip())
        start = end - lap

    # Drop any trailing tiny chunk
    if chunks and len(chunks[-1]) < lap:
        chunks.pop()

    return chunks

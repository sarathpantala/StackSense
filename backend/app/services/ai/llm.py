import logging
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field

from groq import AsyncGroq

from app.core.config import get_settings

logger = logging.getLogger("stacksense")
settings = get_settings()

_client: AsyncGroq | None = None


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


SYSTEM_PROMPT = """You are StackSense, an expert AI assistant for DevOps and software engineering.

IMPORTANT — Detect the intent of the user's message:
- If it is a casual greeting (e.g. "hi", "hai", "hello", "hey", "what's up"), reply with a brief, friendly greeting. Do NOT use the structured format. Keep it to 1-2 sentences.
- If it is a simple yes/no or short conversational message, respond naturally and concisely.
- If it is a knowledge question, technical query, or analysis request, use the structured format below.

For knowledge/technical queries, follow these rules:
- Understand the context thoroughly
- Merge duplicate ideas from multiple sources
- Remove repetition and produce a clean, structured answer
- Cite sources using [1], [2], etc. notation matching the source numbers provided

Strict rules:
- If the answer is not clearly supported by context, say: "This is not explicitly found in the provided documents."
- Do NOT fabricate facts
- Do NOT guess numbers or specifics
- Prefer partial truth over confident wrong answers
- Do NOT repeat similar sentences across your answer
- Do NOT copy text directly from context — rephrase in your own words
- Cite only when attributing a specific fact — do not overuse citations
- Do NOT add irrelevant information not supported by context

If context is insufficient:
- Say "Based on available data, here's the best answer"
- Then answer using general knowledge

Structured format (use ONLY for knowledge/technical queries):

### Answer
<clear explanation>

### Key Points
- point 1
- point 2
- point 3

### Example (if applicable)
<real-world example — omit this section if no example is relevant>

### Sources
- <doc name or [n] reference for each source used>

Tone: {tone}
- simple → Use plain language, minimal jargon, short sentences. Explain like talking to a non-technical person.
- technical → Use moderate technical detail. Assume the reader has working knowledge.
- expert → Use deep technical language, precise terminology, and thorough analysis. Assume domain expertise.

Context:
{context}"""

RCA_SYSTEM_PROMPT = """You are StackSense, an expert DevOps root cause analysis assistant. Analyze the provided logs/errors and:

1. **Pattern Detection**: Identify recurring patterns, error signatures, and anomalies
2. **Root Cause**: Determine the most likely root cause(s)
3. **Impact Assessment**: Rate severity (Critical/High/Medium/Low)
4. **Suggested Fixes**: Provide actionable fixes with confidence scores (0-100%)
5. **Prevention**: Suggest preventive measures

Use the knowledge base context to inform your analysis when relevant.

Format your response with clear markdown headers and structure.

Context from knowledge base:
{context}"""

WORKFLOW_PROMPTS = {
    "analyze": "Provide a thorough, structured analysis of the following. Break down into key components, relationships, and implications:\n\n{input}",
    "summarize": "Based on the previous analysis, provide a concise executive summary with key takeaways:\n\nPrevious analysis:\n{input}",
    "recommend": "Based on the analysis and summary, provide specific, actionable recommendations prioritized by impact and feasibility:\n\nContext:\n{input}",
}

COMMAND_PROMPTS = {
    "debug": "Help debug and troubleshoot this issue. Identify potential causes, suggest diagnostic steps, and provide solutions:\n\n{input}",
    "analyze": "Provide a deep, structured analysis of the following topic. Cover architecture, trade-offs, and best practices:\n\n{input}",
    "explain": "Explain this concept clearly and thoroughly. Use analogies where helpful, cover edge cases, and provide practical examples:\n\n{input}",
    "generate-fix": "Generate a specific code fix or configuration change for this issue. Include before/after examples and explain why the fix works:\n\n{input}",
    "search": "Search the knowledge base for relevant information about:\n\n{input}",
}


@dataclass
class LLMUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class StreamResult:
    """Accumulated metadata from a streaming response."""
    usage: LLMUsage = field(default_factory=LLMUsage)
    latency_ms: float = 0
    model: str = ""


async def generate(query: str, context: str, system_prompt: str | None = None, tone: str = "technical") -> tuple[str, LLMUsage]:
    """Generate a complete response from Groq. Returns (text, usage)."""
    client = _get_client()
    prompt = (system_prompt or SYSTEM_PROMPT).format(context=context, tone=tone)

    start = time.monotonic()
    response = await client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": query},
        ],
        max_tokens=settings.GROQ_MAX_TOKENS,
        temperature=settings.GROQ_TEMPERATURE,
    )
    elapsed = (time.monotonic() - start) * 1000

    usage = LLMUsage(
        prompt_tokens=response.usage.prompt_tokens if response.usage else 0,
        completion_tokens=response.usage.completion_tokens if response.usage else 0,
        total_tokens=response.usage.total_tokens if response.usage else 0,
    )

    logger.info("LLM generate: %dms, %d tokens", int(elapsed), usage.total_tokens)
    return response.choices[0].message.content, usage


async def generate_stream(
    query: str,
    context: str,
    system_prompt: str | None = None,
    tone: str = "technical",
) -> AsyncGenerator[tuple[str, StreamResult | None], None]:
    """Stream response tokens from Groq. Last yield has StreamResult metadata."""
    client = _get_client()
    prompt = (system_prompt or SYSTEM_PROMPT).format(context=context, tone=tone)

    start = time.monotonic()
    stream = await client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": query},
        ],
        max_tokens=settings.GROQ_MAX_TOKENS,
        temperature=settings.GROQ_TEMPERATURE,
        stream=True,
    )

    token_count = 0
    usage_result: StreamResult | None = None
    async for chunk in stream:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            token_count += 1
            yield delta.content, None

        # Groq sends usage via x_groq on the final chunk
        u = getattr(getattr(chunk, "x_groq", None), "usage", None)
        if u is not None and hasattr(u, "prompt_tokens"):
            usage_result = StreamResult(
                usage=LLMUsage(
                    prompt_tokens=u.prompt_tokens,
                    completion_tokens=u.completion_tokens,
                    total_tokens=u.total_tokens,
                ),
                latency_ms=round((time.monotonic() - start) * 1000),
                model=settings.GROQ_MODEL,
            )

    elapsed = round((time.monotonic() - start) * 1000)
    yield "", usage_result or StreamResult(
        usage=LLMUsage(completion_tokens=token_count),
        latency_ms=elapsed,
        model=settings.GROQ_MODEL,
    )

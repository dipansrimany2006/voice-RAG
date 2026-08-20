"""Three guardrail checkpoints the harness routes through:

1. input_guardrail   — before retrieval: reject unsafe/empty input
2. retrieval_guardrail — after retrieval: reject if nothing relevant was found
3. grounding_guardrail — after generation: reject answers not backed by the
   retrieved context (cheap lexical-overlap check, not another LLM call, to
   stay inside the latency budget)
"""

import re
from dataclasses import dataclass

from langchain_core.documents import Document

from .tokenize import tokenize_set

UNSAFE_PATTERNS = [
    r"\bhow (to|do i) (make|build) (a )?(bomb|weapon|explosive)\b",
    r"\b(kill|harm) (myself|someone)\b",
    r"\bcredit card number\b",
]


@dataclass
class GuardrailVerdict:
    allowed: bool
    reason: str = ""


def input_guardrail(query: str) -> GuardrailVerdict:
    if not query or not query.strip():
        return GuardrailVerdict(False, "empty query")
    lowered = query.lower()
    for pattern in UNSAFE_PATTERNS:
        if re.search(pattern, lowered):
            return GuardrailVerdict(False, "unsafe input detected")
    return GuardrailVerdict(True)


def retrieval_guardrail(top_score: float, min_score: float) -> GuardrailVerdict:
    if top_score < min_score:
        return GuardrailVerdict(False, f"low retrieval confidence ({top_score:.2f} < {min_score:.2f}) — likely off-topic")
    return GuardrailVerdict(True)


def grounding_guardrail(answer: str, context_chunks: list[Document], min_overlap: float = 0.15) -> GuardrailVerdict:
    """Flags answers that don't lexically overlap with retrieved context at
    all — a cheap proxy for hallucination that doesn't cost another LLM call."""
    answer_tokens = tokenize_set(answer)
    if not answer_tokens:
        return GuardrailVerdict(False, "empty answer")

    context_tokens: set[str] = set()
    for chunk in context_chunks:
        context_tokens |= tokenize_set(chunk.page_content)

    overlap = len(answer_tokens & context_tokens) / len(answer_tokens)
    if overlap < min_overlap:
        return GuardrailVerdict(False, f"answer not grounded in context (overlap={overlap:.2f})")
    return GuardrailVerdict(True)

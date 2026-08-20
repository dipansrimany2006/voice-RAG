"""Non-LLM answer: pulls the best-matching sentence(s) straight out of the
top retrieved chunk. No model call, so this is cheap enough to run inside
the retrieval-latency budget and give the user something immediately, while
the LLM-polished answer is generated separately (see harness.polish)."""

import re

from langchain_core.documents import Document

from .tokenize import tokenize_set

# Same sentence-boundary set used for chunking (chunking.MULTILINGUAL_SEPARATORS),
# turned into a regex split pattern for sentence-level scoring here.
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[।۔.!?])\s+")

TOP_SENTENCES = 2


def _split_sentences(text: str) -> list[str]:
    sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]
    return sentences or [text.strip()]


def extractive_answer(query: str, chunks: list[Document]) -> str:
    """Returns the sentence(s) from the top-scoring chunk with the highest
    lexical overlap against the query. Falls back to the chunk's leading
    sentence(s) if nothing overlaps (still a real snippet from the source,
    just not query-targeted)."""
    if not chunks:
        return ""

    query_tokens = tokenize_set(query)
    sentences = _split_sentences(chunks[0].page_content)

    scored = sorted(
        sentences,
        key=lambda s: len(query_tokens & tokenize_set(s)),
        reverse=True,
    )
    best = scored[:TOP_SENTENCES] if any(query_tokens & tokenize_set(s) for s in scored[:TOP_SENTENCES]) else sentences[:TOP_SENTENCES]
    return " ".join(best)

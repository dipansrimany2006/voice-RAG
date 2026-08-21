"""Shared multilingual tokenizer used by guardrails, BM25 sparse retrieval, and
extractive answering — one definition so scoring stays consistent everywhere."""

import re

# Latin + Arabic (Urdu) + the contiguous Devanagari-through-Malayalam Unicode
# block, which covers all 14 MSMARCO-XI languages' native scripts (Hindi,
# Bengali, Punjabi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam,
# Marathi, Nepali, Sanskrit, Assamese) plus Urdu separately.
_TOKEN_RE = re.compile(r"[a-zA-Z؀-ۿऀ-ൿ]{2,}")


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def tokenize_set(text: str) -> set[str]:
    return set(tokenize(text))

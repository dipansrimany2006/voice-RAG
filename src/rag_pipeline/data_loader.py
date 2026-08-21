"""Loads ai4bharat/MSMARCO-XI into a flat, multilingual passage corpus.

The dataset is NOT exposed as HF "configs" per language (only 'default'
exists) — it's actually sharded as separate parquet files per language under
train/ and validation/. Streaming those through the `datasets` library hits
a pyarrow bug ("Nested data conversions not implemented for chunked array
outputs") on this schema's nested passages column, so we bypass `datasets`
entirely: download each language's parquet shard directly via
huggingface_hub and read it with pyarrow in one shot (a full-table read
takes a different, working code path than the chunked streaming reader).

We use the `validation` split, not `train`: train shards are ~3.7GB each
(13 languages, ~50GB total) vs. ~460MB for validation, and Telugu has no
train shard at all — only validation. Validation is plenty of passages for
an index (each shard has ~100k+ rows).
"""

import random
from pathlib import Path

import pyarrow.parquet as pq
from huggingface_hub import hf_hub_download
from langchain_core.documents import Document

from .retry import retry

REPO_ID = "ai4bharat/MSMARCO-XI"

# display name -> validation/ parquet filename prefix
LANGUAGE_FILES = {
    "Assamese": "asm",
    "Bengali": "ben",
    "Gujarati": "guj",
    "Hindi": "hin",
    "Kannada": "kan",
    "Malayalam": "mal",
    "Marathi": "mar",
    "Nepali": "nep",
    "Odia": "ori",
    "Punjabi": "pan",
    "Sanskrit": "san",
    "Tamil": "tam",
    "Telugu": "tel",
    "Urdu": "urd",
}


@retry(attempts=3, exceptions=(Exception,), backoff_s=5.0)
def _shard_path(language: str) -> Path:
    # A stalled connection (not an error, just no bytes arriving) can hang
    # indefinitely without this — HF_HUB_DOWNLOAD_TIMEOUT (set at the
    # process level, see Dockerfile) bounds each individual request so a
    # stall surfaces as a timeout error here instead, which this retry
    # wrapper then reattempts rather than hanging forever.
    prefix = LANGUAGE_FILES[language]
    return Path(hf_hub_download(REPO_ID, f"validation/{prefix}val.parquet", repo_type="dataset"))


def load_passages(
    language: str = "Hindi",
    limit: int | None = 2000,
    use_translated: bool = True,
    seed: int = 42,
) -> list[Document]:
    """Flatten one language's MSMARCO-XI validation shard into a deduped passage corpus.

    `limit` bounds the number of source QUERIES (rows) sampled, not passages
    directly — each row yields several passages, so bounding passages instead
    would let the first few sampled rows silently swallow the whole budget.
    Rows are randomly sampled (not the first N in file order) so a modest
    limit still gets topical diversity: the file isn't shuffled by topic, so
    whole query categories cluster in ID ranges and taking the first N rows
    systematically misses them. A fixed seed keeps the sample reproducible.
    """
    if language not in LANGUAGE_FILES:
        raise ValueError(f"unknown language '{language}', choose from {list(LANGUAGE_FILES)}")

    table = pq.read_table(
        _shard_path(language),
        columns=["query_id", "query", "target_lang", "passages"],
    )

    rows = table.to_pylist()
    if limit is not None and limit < len(rows):
        rows = random.Random(seed).sample(rows, limit)

    seen_text: set[str] = set()
    docs: list[Document] = []
    for row in rows:
        passages = row.get("passages") or {}
        texts = passages.get("Translated_passages" if use_translated else "English_passages") or []
        selected_flags = passages.get("is_selected") or [None] * len(texts)

        for text, is_selected in zip(texts, selected_flags):
            if not text or text in seen_text:
                continue
            seen_text.add(text)
            docs.append(
                Document(
                    page_content=text,
                    metadata={
                        "query_id": row.get("query_id"),
                        "query": row.get("query"),
                        "is_selected": bool(is_selected),
                        "language": language,
                        "target_lang_code": row.get("target_lang"),
                        "split": "validation",
                        "source": REPO_ID,
                    },
                )
            )

    return docs


def load_multilingual_passages(
    languages: list[str] | None = None,
    limit_per_language: int = 150,
    use_translated: bool = True,
) -> list[Document]:
    """Build one combined corpus spanning multiple languages — used to build a
    single multilingual index rather than one index per language, since the
    embedding model is multilingual and can match a query in any of these
    languages against the shared corpus directly."""
    languages = languages or list(LANGUAGE_FILES)
    docs: list[Document] = []
    for language in languages:
        print(f"  loading {language}...", flush=True)
        docs.extend(load_passages(language=language, limit=limit_per_language, use_translated=use_translated))
    return docs

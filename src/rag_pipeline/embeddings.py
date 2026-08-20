"""Local multilingual embedding model — no network round-trip at query time,
which matters since the 200ms retrieval budget can't absorb an API call.

torch.set_num_threads(1) matters more than it looks: for a single short-text
query, PyTorch's default multi-threaded intraop pool costs more in thread
wake-up than it saves in parallelism, and that wake-up cost is worst right
after an idle stretch (e.g. the ~1-1.5s blocking STT network call ahead of
embed_query on the voice path) when the pool has gone idle/spun down.
Single-threaded execution sidesteps that variance entirely — one query at a
time is exactly this app's access pattern, never a throughput batch."""

import torch
from langchain_community.embeddings import HuggingFaceEmbeddings

from .config import Settings

torch.set_num_threads(1)


def build_embeddings(settings: Settings) -> HuggingFaceEmbeddings:
    embeddings = HuggingFaceEmbeddings(
        model_name=settings.embedding_model,
        encode_kwargs={"normalize_embeddings": True},
    )
    embeddings.embed_query("warm up")  # pay any one-time model/JIT cost now, not on the first real request
    return embeddings

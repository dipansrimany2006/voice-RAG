"""FAISS index build/load — in-memory/local so retrieval avoids a network hop."""

import os

import faiss
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

# Same reasoning as torch.set_num_threads(1) in embeddings.py: FAISS's default
# OpenMP intraop pool is uncapped, so concurrent searches (e.g. the live
# benchmark's 5-way concurrency) oversubscribe CPU cores and stall on thread
# contention instead of running in parallel — observed as vector_search p90
# jumping from ~26ms to ~270ms under concurrent load. One query at a time per
# call, single-threaded, sidesteps that entirely.
faiss.omp_set_num_threads(1)


def build_index(chunks: list[Document], embeddings: Embeddings, strategy_name: str, index_dir: str) -> FAISS:
    store = FAISS.from_documents(chunks, embeddings)
    path = os.path.join(index_dir, strategy_name)
    os.makedirs(path, exist_ok=True)
    store.save_local(path)
    return store


def load_index(embeddings: Embeddings, strategy_name: str, index_dir: str) -> FAISS:
    path = os.path.join(index_dir, strategy_name)
    return FAISS.load_local(path, embeddings, allow_dangerous_deserialization=True)

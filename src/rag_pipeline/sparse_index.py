"""BM25 sparse index build/load — sits alongside each strategy's FAISS index so
retrieval can fuse dense + sparse results. Built over the exact same `chunks`
list used for the FAISS index of that strategy, so array positions line up
between the two for fusion.
"""

import os
import pickle

import bm25s
from langchain_core.documents import Document

from .tokenize import tokenize

BM25_SUBDIR = "bm25"


def build_bm25(chunks: list[Document], strategy_name: str, index_dir: str) -> None:
    path = os.path.join(index_dir, strategy_name, BM25_SUBDIR)
    os.makedirs(path, exist_ok=True)

    corpus_tokens = [tokenize(c.page_content) for c in chunks]
    index = bm25s.BM25()
    index.index(corpus_tokens, show_progress=False)
    index.save(path, show_progress=False)

    with open(os.path.join(path, "chunks.pkl"), "wb") as f:
        pickle.dump(chunks, f)


def load_bm25(strategy_name: str, index_dir: str) -> tuple[bm25s.BM25, list[Document]]:
    path = os.path.join(index_dir, strategy_name, BM25_SUBDIR)
    index = bm25s.BM25.load(path, load_corpus=False, show_progress=False)
    with open(os.path.join(path, "chunks.pkl"), "rb") as f:
        chunks = pickle.load(f)
    return index, chunks

"""FAISS index build/load — in-memory/local so retrieval avoids a network hop."""

import os

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings


def build_index(chunks: list[Document], embeddings: Embeddings, strategy_name: str, index_dir: str) -> FAISS:
    store = FAISS.from_documents(chunks, embeddings)
    path = os.path.join(index_dir, strategy_name)
    os.makedirs(path, exist_ok=True)
    store.save_local(path)
    return store


def load_index(embeddings: Embeddings, strategy_name: str, index_dir: str) -> FAISS:
    path = os.path.join(index_dir, strategy_name)
    return FAISS.load_local(path, embeddings, allow_dangerous_deserialization=True)

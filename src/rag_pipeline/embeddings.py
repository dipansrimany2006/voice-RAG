"""Local multilingual embedding model — no network round-trip at query time,
which matters since the 200ms retrieval budget can't absorb an API call."""

from langchain_community.embeddings import HuggingFaceEmbeddings

from .config import Settings


def build_embeddings(settings: Settings) -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(
        model_name=settings.embedding_model,
        encode_kwargs={"normalize_embeddings": True},
    )

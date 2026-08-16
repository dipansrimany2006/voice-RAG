"""Query-time retrieval, called directly against the FAISS store (bypassing
LangChain's retriever/chain wrapper) so framework overhead doesn't eat into
the 200ms budget — only real embedding + search work is measured.
"""

from dataclasses import dataclass

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from .latency import LatencyTrace


@dataclass
class RetrievalResult:
    chunks: list[Document]
    scores: list[float]
    strategy: str = ""
    strategy_scores: dict = None  # top score per strategy that was tried, for transparency

    @property
    def top_score(self) -> float:
        return self.scores[0] if self.scores else 0.0


def _search(store: FAISS, query_vector: list[float], k: int) -> RetrievalResult:
    results = store.similarity_search_with_score_by_vector(query_vector, k=k)
    chunks = [doc for doc, _ in results]
    # FAISS returns L2 distance as numpy.float32 by default; convert to a
    # plain-float 0-1 similarity so guardrail thresholds read the same
    # regardless of index metric, and so it's JSON-serializable downstream.
    scores = [1 / (1 + float(score)) for _, score in results]
    return RetrievalResult(chunks=chunks, scores=scores)


def retrieve(
    query: str,
    store: FAISS,
    embeddings: Embeddings,
    trace: LatencyTrace,
    k: int = 4,
) -> RetrievalResult:
    with trace.timed("embed_query"):
        query_vector = embeddings.embed_query(query)
    with trace.timed("vector_search"):
        return _search(store, query_vector, k)


def retrieve_best_strategy(
    query: str,
    stores: dict[str, FAISS],
    embeddings: Embeddings,
    trace: LatencyTrace,
    k: int = 4,
) -> RetrievalResult:
    """Search every built chunking-strategy index for this query and keep
    whichever one returns the highest-confidence top match — chosen per
    query rather than fixed at index-build time, since a strategy that's
    the best fit for one question won't necessarily be the best fit for
    another. The query is embedded once and reused across every store's
    search, so trying N strategies costs one embedding call plus N cheap
    in-memory FAISS searches, not N full retrievals.
    """
    with trace.timed("embed_query"):
        query_vector = embeddings.embed_query(query)

    best: RetrievalResult | None = None
    strategy_scores: dict[str, float] = {}
    with trace.timed("vector_search"):
        for name, store in stores.items():
            result = _search(store, query_vector, k)
            strategy_scores[name] = result.top_score
            if best is None or result.top_score > best.top_score:
                best = result
                best.strategy = name

    best.strategy_scores = strategy_scores
    return best

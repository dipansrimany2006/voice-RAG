"""Query-time retrieval, called directly against the FAISS store (bypassing
LangChain's retriever/chain wrapper) so framework overhead doesn't eat into
the 200ms budget — only real embedding + search work is measured.

Retrieval is hybrid: FAISS dense search is fused with a BM25 sparse search
over the same chunk set via Reciprocal Rank Fusion (RRF). Dense embeddings
miss exact keyword/proper-noun/number matches that BM25 catches, and BM25
misses paraphrases/synonyms that dense catches — fusing both covers more
questions than either alone.
"""

from dataclasses import dataclass

import bm25s
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from .latency import LatencyTrace
from .tokenize import tokenize

RRF_K = 60  # standard RRF damping constant


@dataclass
class RetrievalResult:
    chunks: list[Document]
    scores: list[float]  # RRF-fused scores — encode rank only, not relevance magnitude
    strategy: str = ""
    strategy_scores: dict = None  # top score per strategy that was tried, for transparency
    dense_top_score: float = 0.0  # top raw dense cosine similarity — the actual relevance signal
    sparse_top_score: float = 0.0  # top raw BM25 score — 0 means zero keyword overlap with anything indexed

    @property
    def top_score(self) -> float:
        return self.scores[0] if self.scores else 0.0


@dataclass
class StrategyIndex:
    """Everything needed to search one chunking strategy: its Vectorize store
    plus the parallel BM25 index + chunk list built over the exact same chunks."""

    dense: FAISS
    bm25: bm25s.BM25
    bm25_chunks: list[Document]


def _search_dense(store: FAISS, query_vector: list[float], k: int) -> list[tuple[Document, float]]:
    results = store.similarity_search_with_score_by_vector(query_vector, k=k)
    # FAISS returns L2 distance as numpy.float32 by default; convert to a
    # plain-float 0-1 similarity so guardrail thresholds read the same
    # regardless of index metric, and so it's JSON-serializable downstream.
    return [(doc, 1 / (1 + float(score))) for doc, score in results]


def _search_sparse(bm25: bm25s.BM25, bm25_chunks: list[Document], query: str, k: int) -> list[tuple[Document, float]]:
    query_tokens = tokenize(query)
    if not query_tokens:
        return []
    k = min(k, len(bm25_chunks))
    doc_ids, scores = bm25.retrieve([query_tokens], k=k, show_progress=False)
    return [(bm25_chunks[doc_id], float(score)) for doc_id, score in zip(doc_ids[0], scores[0])]


def _fuse_rrf(
    dense: list[tuple[Document, float]], sparse: list[tuple[Document, float]], k_const: int = RRF_K
) -> list[tuple[Document, float]]:
    """Reciprocal Rank Fusion: combines two ranked lists by rank position
    (not raw score, since dense similarity and BM25 score aren't calibrated
    against each other), keyed by chunk text so the same passage found by
    both rankers is merged into one entry with a boosted score."""
    fused: dict[str, float] = {}
    by_key: dict[str, Document] = {}
    for ranked in (dense, sparse):
        for rank, (doc, _score) in enumerate(ranked):
            key = doc.page_content
            fused[key] = fused.get(key, 0.0) + 1.0 / (k_const + rank + 1)
            by_key.setdefault(key, doc)

    ordered_keys = sorted(fused, key=fused.get, reverse=True)
    return [(by_key[key], fused[key]) for key in ordered_keys]


def _search(index: StrategyIndex, query: str, query_vector: list[float], k: int) -> RetrievalResult:
    dense = _search_dense(index.dense, query_vector, k)
    sparse = _search_sparse(index.bm25, index.bm25_chunks, query, k)
    fused = _fuse_rrf(dense, sparse)[:k]
    chunks = [doc for doc, _ in fused]
    scores = [score for _, score in fused]
    # RRF only encodes rank position, so a top-ranked irrelevant match scores
    # nearly identically to a top-ranked relevant one (verified empirically:
    # gibberish and a genuine match both landed ~0.032-0.033, the RRF ceiling
    # for a rank-0-in-both-retrievers result) — it can't carry a guardrail
    # decision. Dense cosine similarity still can, so it's tracked separately.
    dense_top_score = dense[0][1] if dense else 0.0
    sparse_top_score = sparse[0][1] if sparse else 0.0
    return RetrievalResult(chunks=chunks, scores=scores, dense_top_score=dense_top_score, sparse_top_score=sparse_top_score)


def retrieve(
    query: str,
    index: StrategyIndex,
    embeddings: Embeddings,
    trace: LatencyTrace,
    k: int = 4,
) -> RetrievalResult:
    with trace.timed("embed_query"):
        query_vector = embeddings.embed_query(query)
    with trace.timed("vector_search"):
        return _search(index, query, query_vector, k)


def retrieve_best_strategy(
    query: str,
    indexes: dict[str, StrategyIndex],
    embeddings: Embeddings,
    trace: LatencyTrace,
    k: int = 4,
) -> RetrievalResult:
    """Search every built chunking-strategy index for this query and keep
    whichever one returns the highest-confidence top match — chosen per
    query rather than fixed at index-build time, since a strategy that's
    the best fit for one question won't necessarily be the best fit for
    another. The query is embedded once and reused across every strategy's
    search, so trying N strategies costs one embedding call plus N cheap
    in-memory hybrid searches, not N full retrievals.
    """
    with trace.timed("embed_query"):
        query_vector = embeddings.embed_query(query)

    best: RetrievalResult | None = None
    strategy_scores: dict[str, float] = {}
    with trace.timed("vector_search"):
        for name, index in indexes.items():
            result = _search(index, query, query_vector, k)
            # Selecting the "best" strategy by RRF score would be comparing
            # numbers that don't distinguish relevance (see _search) — dense
            # cosine similarity is the signal that actually varies meaningfully
            # between strategies for the same query.
            strategy_scores[name] = result.dense_top_score
            if best is None or result.dense_top_score > best.dense_top_score:
                best = result
                best.strategy = name

    best.strategy_scores = strategy_scores
    return best

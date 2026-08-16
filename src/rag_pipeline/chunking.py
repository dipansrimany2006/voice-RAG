"""Three chunking strategies over the same corpus, chosen by comparing retrieval
quality at index-build time (see scripts/build_index.py) rather than picked
blind. Each strategy propagates source metadata onto every chunk it produces.
"""

from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Sentence-boundary separators across the corpus's scripts. "। " (danda) is
# shared by Hindi/Marathi/Nepali/Sanskrit/Bengali/Assamese/Odia; "۔ " is the
# Urdu (Arabic-script) full stop. Unmatched separators are simply skipped by
# RecursiveCharacterTextSplitter, so listing all of them is safe for every
# language even though most only match a subset.
MULTILINGUAL_SEPARATORS = ["\n\n", "\n", "। ", "۔ ", ". ", " ", ""]


def fixed_overlap_chunks(docs: list[Document], chunk_size: int = 500, overlap: int = 50) -> list[Document]:
    """Baseline: fixed-size character windows with overlap so answers spanning
    a chunk boundary aren't silently dropped."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=MULTILINGUAL_SEPARATORS,
    )
    chunks = splitter.split_documents(docs)
    for c in chunks:
        c.metadata["chunk_strategy"] = "fixed_overlap"
    return chunks


def semantic_chunks(docs: list[Document], embeddings, breakpoint_threshold: float = 90) -> list[Document]:
    """Splits at points where consecutive sentences' embeddings diverge most,
    instead of at an arbitrary character count — keeps semantically coherent
    passages together even when they're short or long."""
    splitter = SemanticChunker(
        embeddings,
        breakpoint_threshold_type="percentile",
        breakpoint_threshold_amount=breakpoint_threshold,
    )
    chunks = splitter.split_documents(docs)
    for c in chunks:
        c.metadata["chunk_strategy"] = "semantic"
    return chunks


def metadata_aware_chunks(docs: list[Document], chunk_size: int = 500, overlap: int = 50) -> list[Document]:
    """Same fixed-window split as the baseline, but each chunk additionally
    carries its originating query, language, and MSMARCO relevance label
    (`is_selected`) as first-class metadata — used at retrieval time to
    filter/boost instead of relying on text content alone."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=overlap, separators=MULTILINGUAL_SEPARATORS
    )
    chunks = splitter.split_documents(docs)
    for c in chunks:
        c.metadata["chunk_strategy"] = "metadata_aware"
        c.metadata.setdefault("is_selected", False)
    return chunks


STRATEGIES = {
    "fixed_overlap": fixed_overlap_chunks,
    "semantic": semantic_chunks,
    "metadata_aware": metadata_aware_chunks,
}

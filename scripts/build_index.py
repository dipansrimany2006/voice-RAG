"""Offline: load MSMARCO-XI passages across multiple languages, run all three
chunking strategies, embed, and build a FAISS index per strategy under
settings.index_dir. Each index is multilingual — one FAISS store spans every
language passed in, since the embedding model is multilingual and can match
a query in any of them against a shared corpus without per-language routing.

--limit-per-language bounds the number of source QUERIES randomly sampled per
language (not passages directly) — each query contributes several passages,
and random sampling (not first-N) is what gives topical diversity instead of
missing whole categories that cluster in the file's ID ordering.

Usage:
    python scripts/build_index.py --limit-per-language 200
    python scripts/build_index.py --languages Hindi Tamil Bengali --limit-per-language 400
"""

import argparse
import socket
import sys
import time
from pathlib import Path

# Hard safety net below HF Hub's own retry/timeout machinery: a stale or
# broken keep-alive connection reused across many sequential downloads (14
# language shards in one process) can hang a blocking socket call
# indefinitely without ever raising — observed in practice as the whole
# build stalling with zero CPU right after the embedding model loads, not
# reproducible when each shard is fetched in its own fresh process. This
# patches the default timeout for every blocking socket op in the process
# (DNS, connect, recv included), so a stall raises socket.timeout instead
# of hanging forever, which our @retry wrapper on the download then catches.
socket.setdefaulttimeout(30)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from rag_pipeline.chunking import STRATEGIES  # noqa: E402
from rag_pipeline.config import load_settings  # noqa: E402
from rag_pipeline.data_loader import LANGUAGE_FILES, load_multilingual_passages  # noqa: E402
from rag_pipeline.embeddings import build_embeddings  # noqa: E402
from rag_pipeline.sparse_index import build_bm25  # noqa: E402
from rag_pipeline.vectorstore import build_index  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--languages", nargs="+", default=list(LANGUAGE_FILES), help="default: all 14 languages")
    parser.add_argument("--limit-per-language", type=int, default=800, help="source queries randomly sampled per language")
    parser.add_argument("--strategies", nargs="+", default=list(STRATEGIES.keys()))
    args = parser.parse_args()

    settings = load_settings()
    print(f"Sampling up to {args.limit_per_language} queries each from {len(args.languages)} languages: {args.languages}")
    docs = load_multilingual_passages(languages=args.languages, limit_per_language=args.limit_per_language)
    print(f"Loaded {len(docs)} unique passages across all languages.")

    embeddings = build_embeddings(settings)

    for name in args.strategies:
        chunker = STRATEGIES[name]
        print(f"\n[{name}] chunking...")
        t0 = time.perf_counter()
        chunks = chunker(docs, embeddings) if name == "semantic" else chunker(docs)
        print(f"[{name}] {len(chunks)} chunks in {time.perf_counter() - t0:.1f}s")

        t0 = time.perf_counter()
        build_index(chunks, embeddings, name, settings)
        print(f"[{name}] embedded + upserted to Vectorize in {time.perf_counter() - t0:.1f}s")

        t0 = time.perf_counter()
        build_bm25(chunks, name, settings.index_dir)
        print(f"[{name}] BM25 indexed to {settings.index_dir}/{name}/bm25 in {time.perf_counter() - t0:.1f}s")

    print("\nDone. Compare strategies with scripts/benchmark_latency.py --strategy <name>.")


if __name__ == "__main__":
    main()

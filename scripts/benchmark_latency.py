"""Run a batch of test queries through the harness (text-only, no STT/TTS —
those are network-bound voice calls, not part of the 200ms retrieval target)
and report P50/P70/P100 latency, per requirement 4.

By default this exercises the same auto-strategy-selection behavior as the
live app (every built index is tried per query, best match wins). Pass
--strategies to restrict to one, to benchmark it in isolation.

Usage:
    python scripts/benchmark_latency.py --n 50
    python scripts/benchmark_latency.py --strategies fixed_overlap --n 50
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from rag_pipeline.chunking import STRATEGIES  # noqa: E402
from rag_pipeline.config import load_settings  # noqa: E402
from rag_pipeline.data_loader import LANGUAGE_FILES, load_passages  # noqa: E402
from rag_pipeline.embeddings import build_embeddings  # noqa: E402
from rag_pipeline.harness import RagHarness  # noqa: E402
from rag_pipeline.latency import summarize  # noqa: E402
from rag_pipeline.vectorstore import load_index  # noqa: E402


def sample_queries(languages: list[str], n: int) -> list[str]:
    """Pull real MSMARCO-XI queries (not synthetic ones), spread across
    languages, so latency numbers reflect realistic multilingual query text."""
    per_language = max(1, n // len(languages) + 1)
    seen, queries = set(), []
    for language in languages:
        docs = load_passages(language=language, limit=per_language * 3)
        for d in docs:
            q = d.metadata.get("query")
            if q and q not in seen:
                seen.add(q)
                queries.append(q)
            if len([x for x in queries if x]) >= n:
                return queries[:n]
    return queries[:n]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--strategies", nargs="+", default=list(STRATEGIES), help="restrict to these built indexes; default: auto-select across all built")
    parser.add_argument("--languages", nargs="+", default=list(LANGUAGE_FILES), help="default: all 14 languages")
    parser.add_argument("--n", type=int, default=30)
    parser.add_argument("--out", default="benchmark_results/latency.json")
    args = parser.parse_args()

    settings = load_settings()
    embeddings = build_embeddings(settings)
    built = [s for s in args.strategies if (Path(settings.index_dir) / s).exists()]
    if not built:
        raise SystemExit(f"no built indexes among {args.strategies} — run scripts/build_index.py first")
    stores = {name: load_index(embeddings, name, settings.index_dir) for name in built}
    harness = RagHarness(settings, stores, embeddings)

    queries = sample_queries(args.languages, args.n)
    print(f"Running {len(queries)} queries, auto-selecting among strategies={built}...")

    traces = []
    strategy_counts: dict[str, int] = {}
    for i, q in enumerate(queries, 1):
        state = harness.run(q)
        traces.append(state["trace"])
        chosen = state["retrieval"].strategy if state["retrieval"] else None
        if chosen:
            strategy_counts[chosen] = strategy_counts.get(chosen, 0) + 1
        print(f"  [{i}/{len(queries)}] total={state['trace'].total_ms:.1f}ms retrieval_only={state['trace'].retrieval_ms:.1f}ms strategy={chosen} refused={state['refused']}")

    report = summarize(traces)
    report["strategies_tried"] = built
    report["strategy_selection_counts"] = strategy_counts
    print("\n" + json.dumps(report, indent=2))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2))
    print(f"\nSaved to {out_path}")


if __name__ == "__main__":
    main()

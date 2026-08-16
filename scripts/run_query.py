"""Run a single query through the full harness (text or audio file in).

The chunking strategy is chosen automatically per query (whichever built
index retrieves the most confident match) — same behavior as the live app.
Use --strategies to restrict which built indexes are considered, e.g. to
force-test one strategy in isolation.

Usage:
    python scripts/run_query.py --text "your question here"
    python scripts/run_query.py --text "..." --strategies semantic
    python scripts/run_query.py --audio path/to/question.mp3 --speak out.mp3
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from rag_pipeline.chunking import STRATEGIES  # noqa: E402
from rag_pipeline.config import load_settings  # noqa: E402
from rag_pipeline.embeddings import build_embeddings  # noqa: E402
from rag_pipeline.pipeline import VoicePipeline  # noqa: E402
from rag_pipeline.vectorstore import load_index  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--text")
    group.add_argument("--audio")
    parser.add_argument("--strategies", nargs="+", default=list(STRATEGIES), help="restrict to these built indexes")
    parser.add_argument("--speak", help="path to write synthesized answer audio (mp3)")
    args = parser.parse_args()

    settings = load_settings()
    embeddings = build_embeddings(settings)
    built = [s for s in args.strategies if (Path(settings.index_dir) / s).exists()]
    if not built:
        raise SystemExit(f"no built indexes among {args.strategies} — run scripts/build_index.py first")
    stores = {name: load_index(embeddings, name, settings.index_dir) for name in built}
    pipeline = VoicePipeline(settings, stores, embeddings)

    speak = bool(args.speak)
    if args.text:
        result = pipeline.run_text(args.text, speak_response=speak)
    else:
        audio_bytes = Path(args.audio).read_bytes()
        result = pipeline.run_audio(audio_bytes, speak_response=speak)

    print(f"Query:    {result.query_text}")
    print(f"Refused:  {result.refused}" + (f" ({result.refusal_reason})" if result.refused else ""))
    print(f"Answer:   {result.answer_text}")
    print(f"Strategy: {result.selected_strategy} (scores: {result.strategy_scores})")
    print(f"Timings:  {result.trace}")
    print(f"Retrieval-only: {result.retrieval_ms:.1f}ms | Total: {result.total_ms:.1f}ms")

    if speak and result.audio:
        Path(args.speak).write_bytes(result.audio)
        print(f"Audio written to {args.speak}")


if __name__ == "__main__":
    main()

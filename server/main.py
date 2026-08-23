"""FastAPI server exposing the voice RAG pipeline to the frontend.

Loads embeddings once at startup, then loads every chunking-strategy index
that has actually been built under settings.index_dir. The harness picks
the best-fitting strategy per query automatically (see retrieval.py) — the
API surface has no strategy parameter, since strategy selection isn't a
user-facing choice, it's an internal retrieval-quality decision made fresh
for every question.
"""

import asyncio
import base64
import json
import logging
import os
import sys
from pathlib import Path

# Must be set before numpy/torch/faiss are imported anywhere (including
# transitively below) to take effect. Same reasoning as
# torch.set_num_threads(1) / faiss.omp_set_num_threads(1): this app's access
# pattern is one query at a time, so BLAS's default multi-threaded pool only
# adds thread-contention overhead when several queries run concurrently (e.g.
# the live benchmark's 5-way concurrency) rather than any real speedup.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile  # noqa: E402
from fastapi.concurrency import run_in_threadpool  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import StreamingResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from rag_pipeline.chunking import STRATEGIES  # noqa: E402
from rag_pipeline.config import load_settings  # noqa: E402
from rag_pipeline.data_loader import LANGUAGE_FILES, load_passages  # noqa: E402
from rag_pipeline.embeddings import build_embeddings  # noqa: E402
from rag_pipeline.latency import percentiles  # noqa: E402
from rag_pipeline.pipeline import PipelineOutput, VoicePipeline  # noqa: E402
from rag_pipeline.retrieval import StrategyIndex  # noqa: E402
from rag_pipeline.sparse_index import load_bm25  # noqa: E402
from rag_pipeline.vectorstore import load_index  # noqa: E402

BENCHMARK_LANGUAGES = list(LANGUAGE_FILES)
BENCHMARK_CONCURRENCY = 1
BENCHMARK_STAGE_KEYS = ["input_guardrail", "embed_query", "vector_search", "retrieval_guardrail", "extract"]

app = FastAPI(title="Voice RAG Pipeline")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = load_settings()
embeddings = build_embeddings(settings)
_pipeline: VoicePipeline | None = None


def get_pipeline() -> VoicePipeline:
    global _pipeline
    if _pipeline is None:
        built = {s for s in STRATEGIES if (Path(settings.index_dir) / s / "bm25").exists()}
        if not built:
            raise HTTPException(
                503,
                "no chunking-strategy indexes are built yet — run: python scripts/build_index.py",
            )
        indexes = {}
        for name in built:
            dense_store = load_index(embeddings, name, settings)
            bm25_index, bm25_chunks = load_bm25(name, settings.index_dir)
            indexes[name] = StrategyIndex(dense=dense_store, bm25=bm25_index, bm25_chunks=bm25_chunks)
        _pipeline = VoicePipeline(settings, indexes, embeddings)
    return _pipeline


def _serialize(result: PipelineOutput) -> dict:
    return {
        "query_text": result.query_text,
        "answer_text": result.answer_text,
        "refused": result.refused,
        "refusal_reason": result.refusal_reason,
        "grounded": result.grounded,
        "fallback_reason": result.fallback_reason,
        "audio_base64": base64.b64encode(result.audio).decode() if result.audio else None,
        "trace_ms": result.trace,
        "retrieval_ms": result.retrieval_ms,
        "total_ms": result.total_ms,
        "retrieval_under_200ms": result.retrieval_ms < 200,
        "selected_strategy": result.selected_strategy,
        "strategy_scores": result.strategy_scores,
        "answer_source": result.answer_source,
    }


class TextQuery(BaseModel):
    text: str
    speak: bool = False


class SpeakRequest(BaseModel):
    text: str


class PolishRequest(BaseModel):
    query_text: str


# Fixed English/Hindi quick-test pairs — pulled directly from the same
# MSMARCO-XI Hindi validation shard (each row carries both the original
# English query and its Hindi translation), rather than the live benchmark's
# random per-language sampler, so the quick-test chips always show a
# predictable, readable English + Hindi set instead of a fresh random draw
# of the 14 indexed languages on every page load.
FIXED_SAMPLE_QUERIES = [
    ("which angle is an inscribed angle?", "English"),
    ("explain how hormones are distributed throughout the body water soluble", "English"),
    ("harry harlow effects", "English"),
    ("elect power reactor definition", "English"),
    ("how do canker sores heal", "English"),
    ("कौन सा कोण एक अंकित कोण है?", "Hindi"),
    ("हार्मोन कैसे पूरे शरीर में पानी में घुलनशील होते हैं, इसकी व्याख्या करें।", "Hindi"),
    ("हैरी हार्लो प्रभाव", "Hindi"),
    ("विद्युत रिएक्टर की परिभाषा चुनें।", "Hindi"),
    ("कैंकर घाव कैसे ठीक हो सकते हैं", "Hindi"),
]


def _sample_queries_with_language(languages: list[str], n: int) -> list[tuple[str, str]]:
    """Real MSMARCO-XI queries paired with the language they came from — same
    source/dedup/round-robin approach as scripts/benchmark_latency.py's
    sample_queries(), just also keeping the language tag each query needs for
    the live benchmark's per-query display."""
    per_language = max(1, n // len(languages) + 1)
    seen: set[str] = set()
    queries: list[tuple[str, str]] = []
    for language in languages:
        docs = load_passages(language=language, limit=per_language * 3)
        for d in docs:
            q = d.metadata.get("query")
            if q and q not in seen:
                seen.add(q)
                queries.append((q, language))
            if len(queries) >= n:
                return queries[:n]
    return queries[:n]


@app.get("/api/sample-queries")
def sample_queries():
    """Fixed English + Hindi quick-test chips, real questions pulled straight
    from the MSMARCO-XI dataset (see FIXED_SAMPLE_QUERIES) — a predictable,
    readable set so a visitor can try the product without recording audio or
    knowing what to type."""
    return {"queries": [{"text": q, "language": lang} for q, lang in FIXED_SAMPLE_QUERIES]}


@app.get("/api/strategies")
def list_strategies():
    available = [s for s in STRATEGIES if (Path(settings.index_dir) / s / "bm25").exists()]
    return {"strategies": available, "all_strategies": list(STRATEGIES)}


@app.post("/api/query/text")
def query_text(body: TextQuery):
    pipeline = get_pipeline()
    result = pipeline.run_text(body.text, speak_response=body.speak)
    return _serialize(result)


@app.post("/api/query/audio")
async def query_audio(file: UploadFile = File(...), speak: bool = Form(False)):
    pipeline = get_pipeline()
    audio_bytes = await file.read()
    # run_audio is a blocking, CPU/network-bound call (STT + retrieval +
    # TTS) — dispatch it to the worker threadpool instead of running it
    # directly on the event loop, same as FastAPI already does automatically
    # for the sync `def` routes below.
    result = await run_in_threadpool(pipeline.run_audio, audio_bytes, speak_response=speak)
    return _serialize(result)


@app.post("/api/query/polish")
def query_polish(body: PolishRequest):
    """LLM-refined answer for a query already answered via the fast
    extractive path — decoupled from /api/query/* the same way /api/speak
    is, so the initial response never waits on the LLM call."""
    pipeline = get_pipeline()
    result = pipeline.polish_text(body.query_text)
    return _serialize(result)


@app.get("/api/benchmark/run")
async def benchmark_run(request: Request, n: int = 100):
    """Live benchmark: runs `n` real fast-path queries (input guard -> hybrid
    retrieve -> retrieval guard -> extractive answer, no LLM) against the
    already-loaded pipeline, streamed as Server-Sent Events — one real
    per-query result as it completes, then a final aggregate summary. Every
    number here comes from an actual RagHarness.run_fast() call; there is no
    synthetic/precomputed data anywhere in this endpoint.

    Runs up to BENCHMARK_CONCURRENCY queries concurrently (each dispatched to
    the worker threadpool, same pattern as /api/query/audio) to keep total
    wall-clock time reasonable, so completions arrive out of order — each
    event carries its original `index` so the client can place it correctly.
    """
    pipeline = get_pipeline()
    harness = pipeline.harness
    n = max(1, min(n, 500))
    queries = _sample_queries_with_language(BENCHMARK_LANGUAGES, n)

    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()
        semaphore = asyncio.Semaphore(BENCHMARK_CONCURRENCY)

        async def run_one(index: int, query: str, language: str):
            async with semaphore:
                event = {"index": index, "query": query, "language": language}
                try:
                    state = await run_in_threadpool(harness.run_fast, query)
                    trace = state["trace"]
                    retrieval = state["retrieval"]
                    event.update(
                        {
                            "status": "blocked" if state["refused"] else "completed",
                            "trace_ms": dict(trace.stages),
                            "total_ms": trace.total_ms,
                            "retrieval_ms": trace.retrieval_ms,
                            "selected_strategy": retrieval.strategy if retrieval else None,
                            "top_score": retrieval.dense_top_score if retrieval else None,
                            "grounded": state["grounded"],
                            "fallback_reason": state["fallback_reason"],
                            "refused": state["refused"],
                            "refusal_reason": state["refusal_reason"],
                        }
                    )
                except Exception as exc:  # noqa: BLE001 - one bad query must not kill the whole benchmark
                    event.update({"status": "error", "error": str(exc)})
                await queue.put(event)

        tasks = [asyncio.create_task(run_one(i, q, lang)) for i, (q, lang) in enumerate(queries)]

        collected: list[dict] = []
        for _ in tasks:
            event = await queue.get()
            collected.append(event)
            yield f"data: {json.dumps(event)}\n\n"
            if await request.is_disconnected():
                for t in tasks:
                    t.cancel()
                return

        successful = [e for e in collected if e["status"] == "completed"]
        failed = [e for e in collected if e["status"] == "error"]
        blocked = [e for e in collected if e["status"] == "blocked"]
        under_budget = sum(1 for e in successful if e["retrieval_ms"] < 200)

        per_stage: dict[str, list[float]] = {k: [] for k in BENCHMARK_STAGE_KEYS}
        for e in successful:
            for k in BENCHMARK_STAGE_KEYS:
                v = e["trace_ms"].get(k)
                if v is not None:
                    per_stage[k].append(v)

        summary = {
            "n_queries": len(collected),
            "successful": len(successful),
            "failed": len(failed),
            "blocked": len(blocked),
            "under_budget": under_budget,
            "stage_percentiles": {k: percentiles(v) for k, v in per_stage.items()},
            "total_percentiles": percentiles([e["total_ms"] for e in successful]),
            "retrieval_percentiles": percentiles([e["retrieval_ms"] for e in successful]),
        }
        yield f"event: summary\ndata: {json.dumps(summary)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/speak")
def speak(body: SpeakRequest):
    """On-demand TTS for the Listen button — decoupled from /api/query/* so
    answer latency doesn't include synthesis time unless the user actually
    wants to hear it."""
    pipeline = get_pipeline()
    try:
        audio = pipeline.voice.synthesize(body.text)
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).exception("On-demand TTS failed")
        raise HTTPException(502, f"speech synthesis failed: {exc}") from exc
    return {"audio_base64": base64.b64encode(audio).decode()}


@app.get("/api/health")
def health():
    return {"status": "ok"}


frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

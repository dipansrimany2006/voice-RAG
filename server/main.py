"""FastAPI server exposing the voice RAG pipeline to the frontend.

Loads embeddings once at startup, then loads every chunking-strategy index
that has actually been built under settings.index_dir. The harness picks
the best-fitting strategy per query automatically (see retrieval.py) — the
API surface has no strategy parameter, since strategy selection isn't a
user-facing choice, it's an internal retrieval-quality decision made fresh
for every question.
"""

import base64
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from rag_pipeline.chunking import STRATEGIES  # noqa: E402
from rag_pipeline.config import load_settings  # noqa: E402
from rag_pipeline.embeddings import build_embeddings  # noqa: E402
from rag_pipeline.pipeline import PipelineOutput, VoicePipeline  # noqa: E402
from rag_pipeline.vectorstore import load_index  # noqa: E402

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
        built = {s: Path(settings.index_dir) / s for s in STRATEGIES if (Path(settings.index_dir) / s).exists()}
        if not built:
            raise HTTPException(
                503,
                "no chunking-strategy indexes are built yet — run: python scripts/build_index.py",
            )
        stores = {name: load_index(embeddings, name, settings.index_dir) for name in built}
        _pipeline = VoicePipeline(settings, stores, embeddings)
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
    }


class TextQuery(BaseModel):
    text: str
    speak: bool = True


@app.get("/api/strategies")
def list_strategies():
    available = [s for s in STRATEGIES if (Path(settings.index_dir) / s).exists()]
    return {"strategies": available, "all_strategies": list(STRATEGIES)}


@app.post("/api/query/text")
def query_text(body: TextQuery):
    pipeline = get_pipeline()
    result = pipeline.run_text(body.text, speak_response=body.speak)
    return _serialize(result)


@app.post("/api/query/audio")
async def query_audio(file: UploadFile = File(...), speak: bool = Form(True)):
    pipeline = get_pipeline()
    audio_bytes = await file.read()
    result = pipeline.run_audio(audio_bytes, speak_response=speak)
    return _serialize(result)


@app.get("/api/health")
def health():
    return {"status": "ok"}


frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

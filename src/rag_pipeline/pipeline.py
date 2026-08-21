"""End-to-end voice pipeline: audio in -> STT -> harness fast path
(retrieve+guardrails+extractive answer, no LLM) -> TTS -> audio out.

STT and TTS timing share the same LatencyTrace as the harness's internal
stages, so the reported breakdown (and total) covers the whole request, not
just the retrieval portion. The LLM-polished answer is generated separately
via polish_text(), off this critical path.
"""

import logging
from dataclasses import dataclass

from langchain_core.embeddings import Embeddings

from .config import Settings
from .harness import GENERIC_REFUSAL_MESSAGE, RagHarness
from .latency import LatencyTrace
from .retrieval import StrategyIndex
from .voice import VoiceIO

logger = logging.getLogger(__name__)


@dataclass
class PipelineOutput:
    query_text: str
    answer_text: str
    refused: bool  # hard safety block (unsafe/empty input) or total generation failure — no answer given
    refusal_reason: str | None
    grounded: bool  # answer came from retrieved dataset context vs. general-knowledge fallback
    fallback_reason: str | None  # why it fell back, when grounded=False and refused=False
    audio: bytes | None
    trace: dict
    retrieval_ms: float
    total_ms: float
    selected_strategy: str | None
    strategy_scores: dict | None
    answer_source: str | None  # "extractive" (no LLM) or "llm"


class VoicePipeline:
    def __init__(self, settings: Settings, indexes: dict[str, StrategyIndex], embeddings: Embeddings):
        self.settings = settings
        self.voice = VoiceIO(settings)
        self.harness = RagHarness(settings, indexes, embeddings)

    def run_audio(self, audio_bytes: bytes, speak_response: bool = True) -> PipelineOutput:
        trace = LatencyTrace()
        try:
            with trace.timed("stt"):
                query_text = self.voice.transcribe(audio_bytes)
        except Exception as exc:  # noqa: BLE001
            logger.exception("STT transcription failed")
            return PipelineOutput(
                query_text="",
                answer_text="Sorry, I couldn't understand that audio — please try again.",
                refused=True,
                refusal_reason=f"stt_failed: {exc}",
                grounded=False,
                fallback_reason=None,
                audio=None,
                trace=dict(trace.stages),
                retrieval_ms=0.0,
                total_ms=trace.total_ms,
                selected_strategy=None,
                strategy_scores=None,
                answer_source=None,
            )
        return self._run_from_text(query_text, trace, speak_response=speak_response)

    def run_text(self, query_text: str, speak_response: bool = True) -> PipelineOutput:
        return self._run_from_text(query_text, LatencyTrace(), speak_response=speak_response)

    def polish_text(self, query_text: str) -> PipelineOutput:
        """LLM-refined answer for a query already answered via the fast
        extractive path — called separately (like VoiceIO.synthesize is
        called on demand for TTS) so the initial response never waits on
        the LLM."""
        trace = LatencyTrace()
        state = self.harness.polish(query_text, trace=trace)
        answer_text = state["answer"] or GENERIC_REFUSAL_MESSAGE
        retrieval = state["retrieval"]
        return PipelineOutput(
            query_text=query_text,
            answer_text=answer_text,
            refused=state["refused"],
            refusal_reason=state["refusal_reason"],
            grounded=state["grounded"],
            fallback_reason=state["fallback_reason"],
            audio=None,
            trace=dict(trace.stages),
            retrieval_ms=trace.retrieval_ms,
            total_ms=trace.total_ms,
            selected_strategy=retrieval.strategy if retrieval else None,
            strategy_scores=retrieval.strategy_scores if retrieval else None,
            answer_source=state["answer_source"],
        )

    def _run_from_text(self, query_text: str, trace: LatencyTrace, speak_response: bool) -> PipelineOutput:
        state = self.harness.run_fast(query_text, trace=trace)
        # state["answer"] is already user-facing text in every case the fast
        # path can produce (extractive snippet or the model's own in-language
        # refusal) EXCEPT input-guardrail hard blocks and low-confidence
        # retrieval (no chunk worth extracting from) — those need the
        # generic fallback applied here.
        answer_text = state["answer"] or GENERIC_REFUSAL_MESSAGE

        audio = None
        if speak_response and answer_text:
            try:
                with trace.timed("tts"):
                    audio = self.voice.synthesize(answer_text)
            except Exception:  # noqa: BLE001 - TTS failure shouldn't kill a valid text answer
                logger.exception("TTS synthesis failed for query %r", query_text)
                audio = None

        retrieval = state["retrieval"]
        return PipelineOutput(
            query_text=query_text,
            answer_text=answer_text,
            refused=state["refused"],
            refusal_reason=state["refusal_reason"],
            grounded=state["grounded"],
            fallback_reason=state["fallback_reason"],
            audio=audio,
            trace=dict(trace.stages),
            retrieval_ms=trace.retrieval_ms,
            total_ms=trace.total_ms,
            selected_strategy=retrieval.strategy if retrieval else None,
            strategy_scores=retrieval.strategy_scores if retrieval else None,
            answer_source=state["answer_source"],
        )

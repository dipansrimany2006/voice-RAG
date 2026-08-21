"""Per-stage latency instrumentation and percentile reporting."""

import time
from contextlib import contextmanager
from dataclasses import dataclass, field


@dataclass
class LatencyTrace:
    """Timings (ms) for a single query, keyed by pipeline stage."""

    stages: dict = field(default_factory=dict)

    @contextmanager
    def timed(self, stage: str):
        start = time.perf_counter()
        try:
            yield
        finally:
            self.stages[stage] = (time.perf_counter() - start) * 1000

    @property
    def total_ms(self) -> float:
        return sum(self.stages.values())

    @property
    def retrieval_ms(self) -> float:
        """chunking-adjacent + vector DB retrieval only — the piece the 200ms target covers."""
        return self.stages.get("embed_query", 0) + self.stages.get("vector_search", 0)


def percentile(values: list, pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, int(round((pct / 100) * (len(ordered) - 1))))
    return ordered[idx]


def percentiles(values: list, pcts=(50, 70, 90, 99, 100)) -> dict:
    """Same nearest-rank percentile as `percentile()`, computed for several
    percentiles at once — used by the live benchmark dashboard's stage x
    percentile table, which needs P90/P99 in addition to the P50/P70/P100
    `summarize()` already reports for the CLI benchmark."""
    return {f"p{p}": percentile(values, p) for p in pcts}


def summarize(traces: list) -> dict:
    """Aggregate a list of LatencyTrace into P50/P70/P100 for total and retrieval-only latency."""
    totals = [t.total_ms for t in traces]
    retrieval = [t.retrieval_ms for t in traces]
    per_stage = {}
    for t in traces:
        for stage, ms in t.stages.items():
            per_stage.setdefault(stage, []).append(ms)

    return {
        "n_queries": len(traces),
        "total_ms": {
            "p50": percentile(totals, 50),
            "p70": percentile(totals, 70),
            "p100": percentile(totals, 100),
        },
        "retrieval_only_ms": {
            "p50": percentile(retrieval, 50),
            "p70": percentile(retrieval, 70),
            "p100": percentile(retrieval, 100),
        },
        "per_stage_p50_ms": {stage: percentile(vals, 50) for stage, vals in per_stage.items()},
    }

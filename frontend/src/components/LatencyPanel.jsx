import { useEffect, useRef, useState } from 'react'

function fmt(ms) {
  return ms == null ? '—' : `${ms.toFixed(0)}ms`
}

// Counts up from 0 to the real measured value whenever it changes — not a
// decorative loop, just makes an already-real number land with a bit of
// weight instead of appearing instantly.
function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(target)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (target == null) {
      prevTarget.current = target
      return
    }
    if (prevTarget.current === target) return
    prevTarget.current = target
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    const start = performance.now()
    let raf
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) * (1 - progress)
      setValue(target * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return target == null ? null : value
}

// Formats a real, frontend-measured duration per the product's display rule:
// plain milliseconds under a second, otherwise seconds to two decimals.
export function formatResponseTime(ms) {
  if (ms == null) return null
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`
}

// Builds the six real pipeline stages for one request from the two actual
// HTTP responses involved: `result` (the fast, extractive /api/query/*
// response — STT/guard/RAG/context-guard all happen inside that one real
// backend LatencyTrace, see rag_pipeline/latency.py) and `polished` (the
// separate /api/query/polish response carrying the real LLM generation
// time). Every value here is either read straight from a measured
// trace_ms field, summed from a couple of them, or a real
// performance.now() delta captured in AnswerPanel — never invented. A
// stage that genuinely didn't run for this request (wrong modality,
// blocked upstream, not yet returned) is `null` and rendered as N/A.
function buildStages({ result, polished, polishState, polishLatencyMs, polishErrorMessage, frontendLatencyMs }) {
  const trace = result?.trace_ms || {}
  const polishTrace = polished?.trace_ms || {}
  const refusalReason = result?.refusal_reason || ''

  const sttValue = trace.stt ?? null
  const sttFailed = Boolean(result?.refused) && refusalReason.startsWith('stt_failed')

  const guardValue = trace.input_guardrail ?? null
  const guardBlocked = Boolean(result?.refused) && !sttFailed && guardValue != null

  const ragValue = trace.embed_query != null && trace.vector_search != null ? trace.embed_query + trace.vector_search : null

  const contextValue = trace.retrieval_guardrail ?? null
  const contextFallback = Boolean(result) && !result.refused && result.grounded === false && Boolean(result.fallback_reason)

  let llmValue = null
  let llmState = 'na'
  let llmNote = null
  if (polishState === 'loading') {
    llmState = 'processing'
  } else if (polishState === 'ready') {
    const generateMs = (polishTrace.generate || 0) + (polishTrace.fallback_generate || 0)
    llmValue = generateMs > 0 ? generateMs : null
    llmState = polished?.refused ? 'error' : 'completed'
    llmNote = polished?.refused ? polished.refusal_reason : null
  } else if (polishState === 'error') {
    llmState = 'error'
    llmNote = polishErrorMessage
  }

  let endValue = null
  let endState = 'na'
  if (result) {
    if (polishState === 'ready' || polishState === 'error') {
      endValue = (frontendLatencyMs || 0) + (polishLatencyMs || 0)
      endState = polishState === 'error' ? 'error' : 'completed'
    } else if (polishState === 'loading') {
      endValue = frontendLatencyMs
      endState = 'processing'
    } else {
      // No polish stage applies at all — a hard block (bad input / STT
      // failure) that never reached generation. The fast response is the
      // final one for this request.
      endValue = frontendLatencyMs
      endState = result.refused ? 'blocked' : 'completed'
    }
  }

  return [
    {
      key: 'stt',
      label: 'STT VOICE',
      value: sttValue,
      state: sttValue == null ? 'na' : sttFailed ? 'error' : 'completed',
      note: sttFailed ? refusalReason : null,
    },
    {
      key: 'guard',
      label: 'INPUT GUARD',
      value: guardValue,
      state: guardValue == null ? 'na' : guardBlocked ? 'blocked' : 'completed',
      note: guardBlocked ? refusalReason : null,
    },
    {
      key: 'rag',
      label: 'RAG SEARCH',
      value: ragValue,
      state: ragValue == null ? 'na' : 'completed',
    },
    {
      key: 'context',
      label: 'CONTEXT GUARD',
      value: contextValue,
      state: contextValue == null ? 'na' : 'completed',
      note: contextFallback ? result.fallback_reason : null,
    },
    {
      key: 'llm',
      label: 'LLM ANSWER',
      value: llmValue,
      state: llmState,
      note: llmNote,
    },
    {
      key: 'end',
      label: 'END-TO-END',
      value: endValue,
      state: endState,
      highlight: true,
    },
  ]
}

const STATE_TEXT = {
  completed: 'DONE',
  processing: 'RUNNING',
  error: 'ERROR',
  blocked: 'BLOCKED',
  na: 'N/A',
}

// The current query's own real pipeline telemetry — one row per actual
// backend/frontend stage, sourced from the real LatencyTrace the server
// measured for this exact request (see harness.py / latency.py) plus the
// real frontend-measured polish round-trip. Renders nothing outside
// loading/success so it never leaves an empty row sitting in the layout.
export default function LatencyPanel({ status, result, frontendLatencyMs, polished, polishState, polishLatencyMs, polishErrorMessage }) {
  if (status === 'loading') {
    return (
      <div className="telemetry-panel telemetry-panel--skeleton" aria-hidden="true">
        <div className="telemetry-panel__head">
          <span className="telemetry-panel__title-skeleton" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="telemetry-row telemetry-row--skeleton" key={i} />
        ))}
      </div>
    )
  }

  // Rendered for every real completed request, including refused/blocked
  // ones — that's exactly the case the ERROR/BLOCKED stage states below
  // exist to show honestly, not something to hide.
  if (status !== 'success' || !result) return null

  const stages = buildStages({ result, polished, polishState, polishLatencyMs, polishErrorMessage, frontendLatencyMs })

  return (
    <div className="telemetry-panel" role="group" aria-label="Pipeline telemetry and latency">
      <div className="telemetry-panel__head">
        <span className="telemetry-panel__title">PIPELINE TELEMETRY &amp; LATENCY</span>
        {result.selected_strategy && <span className="badge badge--sm badge--info">{result.selected_strategy}</span>}
      </div>
      <div className="telemetry-panel__rows">
        {stages.map((stage) => (
          <StageRow key={stage.key} stage={stage} />
        ))}
      </div>
    </div>
  )
}

function StageRow({ stage }) {
  const animated = useCountUp(stage.value)
  return (
    <div className={`telemetry-row telemetry-row--${stage.state}${stage.highlight ? ' telemetry-row--highlight' : ''}`}>
      <span className={`telemetry-row__dot telemetry-row__dot--${stage.state}`} aria-hidden="true" />
      <span className="telemetry-row__label">{stage.label}</span>
      <span className="telemetry-row__value">{fmt(animated)}</span>
      <span className={`telemetry-row__state telemetry-row__state--${stage.state}`}>{STATE_TEXT[stage.state]}</span>
      {stage.note && <span className="telemetry-row__note">{stage.note}</span>}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

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

// Nearest-rank percentile over an already-sorted array. With one sample,
// every percentile is that sample — correct, not a bug.
function percentile(sorted, p) {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

// The session performance strip — P50/P70/P100/budget/live, computed
// entirely from this session's own real query totals (`history`, built
// by VoiceApp.jsx from each real response's total_ms/retrieval_under_200ms
// as it lands). Nothing here is invented: with zero queries so far, every
// value is a plain em dash rather than a placeholder number.
export function SessionMetrics({ history }) {
  const { t } = useLanguage()
  const sorted = history.map((h) => h.total).sort((a, b) => a - b)
  const total = history.length
  const underBudgetCount = history.filter((h) => h.underBudget).length

  return (
    <div className="metrics-strip" role="group" aria-label={t('pipeline.latencyTitle')}>
      <MetricBlock label="P50" value={percentile(sorted, 50)} />
      <MetricBlock label="P70" value={percentile(sorted, 70)} />
      <MetricBlock label="P100" value={percentile(sorted, 100)} />
      <div className="metrics-strip__block">
        <span className="metrics-strip__value">{total > 0 ? `${underBudgetCount}/${total}` : '—'}</span>
        <span className="metrics-strip__label">{t('pipeline.underBudgetLabel')}</span>
      </div>
      <div className="metrics-strip__block metrics-strip__block--live">
        <span className="metrics-strip__live-dot" aria-hidden="true" />
        <span className="metrics-strip__value">{total}</span>
        <span className="metrics-strip__label">
          {t('pipeline.liveLabel')} · {t('pipeline.queriesLabel')}
        </span>
      </div>
    </div>
  )
}

function MetricBlock({ label, value }) {
  const animated = useCountUp(value)
  return (
    <div className="metrics-strip__block">
      <span className="metrics-strip__value">
        {animated == null ? '—' : animated.toFixed(1)}
        {animated != null && <span className="metrics-strip__unit">ms</span>}
      </span>
      <span className="metrics-strip__label">{label}</span>
    </div>
  )
}

// The current query's own technical breakdown — response time, STT,
// retrieval, generation and total, all real (frontendLatencyMs /
// result.trace_ms / result.retrieval_ms / result.total_ms), plus which
// chunking strategy was auto-selected and the retrieval-budget badge.
// Renders nothing outside loading/success so it never leaves an empty
// row sitting in the layout.
export default function LatencyPanel({ status, result, frontendLatencyMs }) {
  const { t } = useLanguage()

  if (status === 'loading') {
    return (
      <div className="rag-row rag-row--skeleton" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="rag-row__skeleton-block" key={i} />
        ))}
      </div>
    )
  }

  if (status !== 'success' || !result || result.refused) return null

  const trace = result.trace_ms || {}
  const fields = [
    { label: t('pipeline.responseTimeLabel'), value: frontendLatencyMs, highlight: true },
    { label: t('pipeline.latencySTT'), value: trace.stt },
    { label: t('pipeline.latencyRetrieval'), value: result.retrieval_ms },
    { label: t('pipeline.latencyGeneration'), value: trace.generate },
    { label: t('pipeline.latencyTotal'), value: result.total_ms },
  ]

  return (
    <div className="rag-row">
      {fields.map((f) => (
        <RagField key={f.label} label={f.label} value={f.value} highlight={f.highlight} />
      ))}
      {result.selected_strategy && (
        <div className="rag-row__field">
          <span className="rag-row__label">{t('answer.chunkingStrategyUsed')}</span>
          <span className="rag-row__value rag-row__value--text">{result.selected_strategy}</span>
        </div>
      )}
      <span className={`badge badge--sm ${result.retrieval_under_200ms ? 'badge--ok' : 'badge--warn'}`}>
        {result.retrieval_under_200ms ? t('pipeline.retrievalUnder') : t('pipeline.retrievalOver')}
      </span>
    </div>
  )
}

function RagField({ label, value, highlight }) {
  const animated = useCountUp(value)
  return (
    <div className={`rag-row__field${highlight ? ' rag-row__field--highlight' : ''}`}>
      <span className="rag-row__label">{label}</span>
      <span className="rag-row__value">{fmt(animated)}</span>
    </div>
  )
}

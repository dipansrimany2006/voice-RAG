import { useLanguage } from '../i18n/LanguageContext'

function fmt(ms) {
  return ms == null ? '—' : `${ms.toFixed(0)}ms`
}

// Formats a real, frontend-measured duration per the product's display rule:
// plain milliseconds under a second, otherwise seconds to two decimals.
// Exported so AnswerPanel can show the same real number inline next to the
// answer, not just in the separate latency panel.
export function formatResponseTime(ms) {
  if (ms == null) return null
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`
}

export default function LatencyPanel({ status, result, frontendLatencyMs }) {
  const { t } = useLanguage()

  if (status === 'loading') {
    return (
      <div>
        <div className="latency-hero latency-hero--skeleton" aria-hidden="true" />
        <div className="latency-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="latency-card latency-card--skeleton" key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (status === 'idle' || status === 'error' || !result) {
    return <p className="empty-state">{t('pipeline.latencyEmpty')}</p>
  }

  const trace = result.trace_ms || {}
  const metrics = [
    { label: t('pipeline.latencySTT'), value: trace.stt },
    { label: t('pipeline.latencyRetrieval'), value: result.retrieval_ms },
    { label: t('pipeline.latencyGeneration'), value: trace.generate },
    { label: t('pipeline.latencyTotal'), value: result.total_ms, highlight: true },
  ]

  return (
    <div>
      {frontendLatencyMs != null && (
        <div className="latency-hero">
          <span className="latency-hero__value">{formatResponseTime(frontendLatencyMs)}</span>
          <span className="latency-hero__label">{t('pipeline.responseTimeLabel')}</span>
        </div>
      )}

      <div className="latency-grid">
        {metrics.map((m) => (
          <div className={`latency-card${m.highlight ? ' latency-card--highlight' : ''}`} key={m.label}>
            <span className="latency-card__label">{m.label}</span>
            <span className="latency-card__value">{fmt(m.value)}</span>
          </div>
        ))}
      </div>
      <span className={`badge ${result.retrieval_under_200ms ? 'badge--ok' : 'badge--warn'}`}>
        {result.retrieval_under_200ms ? t('pipeline.retrievalUnder') : t('pipeline.retrievalOver')}
      </span>
    </div>
  )
}

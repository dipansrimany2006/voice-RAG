const STAGE_LABELS = {
  input_guardrail: 'Input guardrail',
  stt: 'Speech-to-text',
  embed_query: 'Embed query',
  vector_search: 'Vector search',
  retrieval_guardrail: 'Retrieval guardrail',
  generate: 'LLM generation',
  grounding_guardrail: 'Grounding guardrail',
  tts: 'Text-to-speech',
}

function stageLabel(key) {
  return STAGE_LABELS[key] || key
}

export default function LatencyPanel({ status, result }) {
  if (status === 'loading') {
    return (
      <div className="latency-skeleton" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="skeleton-bar" key={i} />
        ))}
      </div>
    )
  }

  if (status === 'idle' || !result) {
    return <p className="empty-state">Latency breakdown appears after your first query.</p>
  }

  const stages = Object.entries(result.trace_ms || {}).sort((a, b) => b[1] - a[1])
  const maxMs = Math.max(...stages.map(([, ms]) => ms), 1)

  return (
    <div>
      <div className="latency-summary">
        <div className="latency-stat">
          <span className="latency-stat-label">Total</span>
          <span className="latency-stat-value">{result.total_ms.toFixed(0)}ms</span>
        </div>
        <div className="latency-stat">
          <span className="latency-stat-label">Retrieval only</span>
          <span className="latency-stat-value">{result.retrieval_ms.toFixed(0)}ms</span>
        </div>
        <span
          className={`badge ${result.retrieval_under_200ms ? 'badge--ok' : 'badge--warn'}`}
        >
          {result.retrieval_under_200ms ? 'Under 200ms target' : 'Over 200ms target'}
        </span>
      </div>

      <ul className="latency-bars" aria-label="Latency per pipeline stage">
        {stages.map(([stage, ms]) => (
          <li className="latency-bar-row" key={stage}>
            <span className="latency-bar-label">{stageLabel(stage)}</span>
            <div className="latency-bar-track">
              <div
                className="latency-bar-fill"
                style={{ width: `${Math.max((ms / maxMs) * 100, 2)}%` }}
              />
            </div>
            <span className="latency-bar-value">{ms.toFixed(1)}ms</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'voice-rag-benchmark-last-run'
const BENCHMARK_N = 100

const STAGE_ROWS = [
  ['input_guardrail', 'INPUT GUARD'],
  ['embed_query', 'EMBED QUERY'],
  ['vector_search', 'VECTOR SEARCH'],
  ['retrieval_guardrail', 'RETRIEVAL GUARD'],
  ['extract', 'EXTRACT'],
]
const PCT_COLS = ['p50', 'p70', 'p90', 'p99', 'p100']

function fmtMs(v) {
  return v == null ? '—' : `${v.toFixed(1)}`
}

function loadPersisted() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persist(summary, results) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ summary, results }))
  } catch {
    // storage full/unavailable — the live run still displays, it just won't survive a refresh
  }
}

// A real, no-mock-data benchmark control: fires an SSE request against
// GET /api/benchmark/run, which runs BENCHMARK_N real queries through the
// actual RagHarness.run_fast() fast path and streams one real per-query
// result at a time, then a final aggregate summary. Every number rendered
// here traces back to that stream — nothing is computed or guessed on the
// frontend.
export default function BenchmarkPanel() {
  const [runState, setRunState] = useState('idle') // idle | running | done | failed
  const [completed, setCompleted] = useState(0)
  const [results, setResults] = useState([])
  const [summary, setSummary] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const esRef = useRef(null)

  // Load the last REAL completed run on mount so a refresh shows real
  // history instead of a blank/fake state — never overwritten except by
  // a fresh run actually reaching its summary event.
  useEffect(() => {
    const persisted = loadPersisted()
    if (persisted?.summary) {
      setSummary(persisted.summary)
      setResults(persisted.results || [])
      setCompleted(persisted.results?.length || 0)
      setRunState('done')
    }
    return () => esRef.current?.close()
  }, [])

  function runBenchmark() {
    if (runState === 'running') return
    esRef.current?.close()

    setRunState('running')
    setCompleted(0)
    setResults([])
    setSummary(null)
    setErrorMessage(null)

    const es = new EventSource(`/api/benchmark/run?n=${BENCHMARK_N}`)
    esRef.current = es
    let gotSummary = false

    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data)
      setResults((prev) => {
        const next = prev.slice()
        next[data.index] = data
        return next
      })
      setCompleted((c) => c + 1)
    }

    es.addEventListener('summary', (ev) => {
      gotSummary = true
      const data = JSON.parse(ev.data)
      setSummary(data)
      setRunState('done')
      es.close()
      setResults((current) => {
        persist(data, current)
        return current
      })
    })

    es.onerror = () => {
      if (!gotSummary) {
        setErrorMessage('Lost connection to the benchmark stream before it finished.')
        setRunState('failed')
      }
      es.close()
    }
  }

  const isRunning = runState === 'running'
  const buttonLabel = isRunning ? `RUNNING ${completed} / ${BENCHMARK_N}` : summary ? 'RUN AGAIN' : 'RUN 100 LIVE'
  const statusText = isRunning ? 'RUNNING' : runState === 'failed' ? 'FAILED' : summary ? 'COMPLETE' : 'IDLE'

  return (
    <section className="benchmark-panel" aria-labelledby="benchmark-heading">
      <div className="benchmark-panel__head">
        <div>
          <h2 id="benchmark-heading" className="benchmark-panel__title">
            LIVE BENCHMARK
          </h2>
          <p className="benchmark-panel__subtitle">
            Runs {BENCHMARK_N} real queries through the fast retrieval path and measures actual latency — no mock data.
          </p>
        </div>
        <div className="benchmark-panel__status">
          <span className={`benchmark-panel__status-dot benchmark-panel__status-dot--${runState}`} aria-hidden="true" />
          <span>{statusText}</span>
          {(isRunning || summary) && (
            <span className="benchmark-panel__status-count">
              {isRunning ? completed : summary?.n_queries || 0} / {BENCHMARK_N} queries
            </span>
          )}
        </div>
      </div>

      <button type="button" className="btn btn--primary benchmark-panel__run-btn" onClick={runBenchmark} disabled={isRunning}>
        {isRunning && <span className="benchmark-panel__spinner" aria-hidden="true" />}
        {buttonLabel}
      </button>

      {runState === 'failed' && (
        <div className="benchmark-panel__error" role="alert">
          <p className="benchmark-panel__error-title">BENCHMARK FAILED</p>
          <p className="benchmark-panel__error-reason">Reason: {errorMessage}</p>
          {completed > 0 && <p className="benchmark-panel__error-partial">{completed} real result(s) were collected before the stream dropped.</p>}
        </div>
      )}

      {summary && (
        <>
          <div className="metrics-strip benchmark-panel__cards">
            {PCT_COLS.filter((c) => c !== 'p100').map((c) => (
              <div className="metrics-strip__block" key={c}>
                <span className="metrics-strip__value">
                  {fmtMs(summary.total_percentiles?.[c])}
                  <span className="metrics-strip__unit">ms</span>
                </span>
                <span className="metrics-strip__label">{c.toUpperCase()}</span>
              </div>
            ))}
            <div className="metrics-strip__block">
              <span className="metrics-strip__value">
                {summary.under_budget}/{summary.successful}
              </span>
              <span className="metrics-strip__label">UNDER BUDGET</span>
            </div>
            <div className="metrics-strip__block metrics-strip__block--live">
              <span className="metrics-strip__live-dot" aria-hidden="true" />
              <span className="metrics-strip__value">{summary.n_queries}</span>
              <span className="metrics-strip__label">LIVE QUERIES</span>
            </div>
          </div>

          <div className="benchmark-panel__budget-bar">
            <div
              className={`benchmark-panel__budget-fill${(summary.total_percentiles?.p50 ?? 0) > 200 ? ' benchmark-panel__budget-fill--over' : ''}`}
              style={{ width: `${Math.min(100, ((summary.total_percentiles?.p50 || 0) / 200) * 100)}%` }}
            />
            <span className="benchmark-panel__budget-label">
              {fmtMs(summary.total_percentiles?.p50)}ms P50 · 200ms budget
              {summary.failed > 0 ? ` · ${summary.failed} failed` : ''}
              {summary.blocked > 0 ? ` · ${summary.blocked} blocked` : ''}
            </span>
          </div>

          <div className="benchmark-panel__table-wrap">
            <table className="benchmark-panel__table">
              <thead>
                <tr>
                  <th>STAGE</th>
                  {PCT_COLS.map((c) => (
                    <th key={c}>{c.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STAGE_ROWS.map(([key, label]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    {PCT_COLS.map((c) => (
                      <td key={c}>{fmtMs(summary.stage_percentiles?.[key]?.[c])}</td>
                    ))}
                  </tr>
                ))}
                <tr className="benchmark-panel__table-total">
                  <td>FAST PATH TOTAL</td>
                  {PCT_COLS.map((c) => (
                    <td key={c}>{fmtMs(summary.total_percentiles?.[c])}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <details className="answer-source benchmark-panel__details" open={expanded} onToggle={(e) => setExpanded(e.target.open)}>
            <summary>Query-level details ({results.filter(Boolean).length})</summary>
            <div className="benchmark-panel__query-list">
              {results.map((r, i) =>
                r ? (
                  <div key={i} className={`telemetry-row benchmark-panel__query-row telemetry-row--${r.status}`}>
                    <span className={`telemetry-row__dot telemetry-row__dot--${r.status}`} aria-hidden="true" />
                    <span className="benchmark-panel__query-index">{String(r.index + 1).padStart(3, '0')}</span>
                    <span className="benchmark-panel__query-text">{r.query}</span>
                    <span className="benchmark-panel__query-lang">{r.language}</span>
                    <span className="telemetry-row__value">
                      {r.status === 'error' ? r.error : `${fmtMs(r.retrieval_ms)}ms retrieval · ${fmtMs(r.total_ms)}ms total`}
                    </span>
                    {(r.top_score != null || r.fallback_reason) && (
                      <span className="telemetry-row__note">
                        {r.top_score != null && `confidence ${r.top_score.toFixed(3)}`}
                        {r.fallback_reason ? ` · ${r.fallback_reason}` : ''}
                      </span>
                    )}
                  </div>
                ) : null
              )}
            </div>
          </details>
        </>
      )}
    </section>
  )
}

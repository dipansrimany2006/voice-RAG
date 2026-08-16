import { useEffect, useRef, useState } from 'react'

const STRATEGY_LABELS = {
  fixed_overlap: 'Fixed-size + overlap',
  semantic: 'Semantic',
  metadata_aware: 'Metadata-aware',
}

function strategyLabel(key) {
  return STRATEGY_LABELS[key] || key
}

export default function AnswerPanel({ status, result, error, onRetry }) {
  const audioRef = useRef(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)

  useEffect(() => {
    if (!result?.audio_base64 || !audioRef.current) return
    setAutoplayBlocked(false)
    audioRef.current.play().catch(() => {
      // Browsers can block programmatic autoplay depending on user-gesture
      // timing — the visible player below still lets the user hit play.
      setAutoplayBlocked(true)
    })
  }, [result?.audio_base64])

  if (status === 'idle') {
    return <p className="empty-state">Ask a question to see the transcript and answer here.</p>
  }

  if (status === 'loading') {
    return (
      <div className="answer-skeleton" aria-hidden="true">
        <div className="skeleton-line skeleton-line--short" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line--short" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="error-state">
        <p>{error || 'Something went wrong reaching the pipeline.'}</p>
        <button type="button" className="secondary-button" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="answer-content">
      <div className="answer-block">
        <span className="answer-label">You asked</span>
        <p className="answer-query">{result.query_text || '(no speech detected)'}</p>
      </div>

      {result.refused ? (
        <div className="answer-block answer-block--refused">
          <span className="answer-label">Blocked, no answer given</span>
          <p>{result.answer_text}</p>
          {result.refusal_reason && (
            <p className="answer-reason">
              <span className="answer-reason-tag">guardrail:</span> {result.refusal_reason}
            </p>
          )}
        </div>
      ) : (
        <div className={`answer-block${result.grounded ? '' : ' answer-block--fallback'}`}>
          <span className="answer-label">
            {result.grounded ? 'Answer' : 'Answer (general knowledge, not from dataset)'}
          </span>
          <p>{result.answer_text}</p>
          {!result.grounded && result.fallback_reason && (
            <p className="answer-reason">
              <span className="answer-reason-tag">fallback reason:</span> {result.fallback_reason}
            </p>
          )}
        </div>
      )}

      {result.selected_strategy && (
        <div className="answer-block">
          <span className="answer-label">Chunking strategy used (auto-selected)</span>
          <p className="answer-strategy">
            <span className="badge badge--info">{strategyLabel(result.selected_strategy)}</span>
          </p>
          {result.strategy_scores && (
            <ul className="strategy-scores">
              {Object.entries(result.strategy_scores)
                .sort((a, b) => b[1] - a[1])
                .map(([name, score]) => (
                  <li key={name}>
                    {strategyLabel(name)}: {score.toFixed(3)}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {result.audio_base64 && (
        <div className="answer-audio-block">
          <audio
            ref={audioRef}
            controls
            src={`data:audio/mpeg;base64,${result.audio_base64}`}
            className="answer-audio"
          >
            Your browser does not support audio playback.
          </audio>
          {autoplayBlocked && (
            <p className="answer-reason" role="status">
              Tap play to hear the answer — your browser blocked autoplay.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

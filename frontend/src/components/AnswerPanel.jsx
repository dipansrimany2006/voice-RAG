import { useEffect, useRef, useState } from 'react'
import { speak } from '../api'
import { PlayIcon, PauseIcon, CopyIcon, CheckIcon, RefreshIcon, AlertIcon, WaveformIcon } from './Icons'
import { friendlyError } from '../errorMessages'
import { formatResponseTime } from './LatencyPanel'
import { useLanguage } from '../i18n/LanguageContext'

const STRATEGY_LABEL_KEY = {
  fixed_overlap: 'answer.strategyFixedOverlap',
  semantic: 'answer.strategySemantic',
  metadata_aware: 'answer.strategyMetadataAware',
}

export default function AnswerPanel({ status, result, error, onRetry, onAskAgain, language, frontendLatencyMs }) {
  const { t } = useLanguage()
  const audioRef = useRef(null)
  // Audio is fetched on demand from POST /api/speak when the user clicks
  // Listen — the query response itself never carries audio (TTS latency
  // shouldn't be paid on every answer, only when someone wants to hear it).
  const [listenState, setListenState] = useState('idle') // idle | loading | ready | error
  const [audioSrc, setAudioSrc] = useState(null)
  const [listenError, setListenError] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [copied, setCopied] = useState(false)

  // A new answer arrived — forget any previously synthesized audio so the
  // Listen button re-fetches for the current answer instead of replaying
  // the last one.
  useEffect(() => {
    setListenState('idle')
    setAudioSrc(null)
    setListenError(null)
    setIsPlaying(false)
    setAutoplayBlocked(false)
  }, [result?.answer_text])

  // Autoplay once the fetched audio is ready — this still counts as
  // triggered by a user gesture (the Listen click that started the fetch),
  // but some browsers block play() when it isn't called synchronously
  // within the click handler itself, hence the fallback message below.
  useEffect(() => {
    if (audioSrc && audioRef.current) {
      setAutoplayBlocked(false)
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setAutoplayBlocked(true))
    }
  }, [audioSrc])

  async function handleListen() {
    if (!result?.answer_text) return
    setListenState('loading')
    setListenError(null)
    try {
      const data = await speak({ text: result.answer_text })
      setAudioSrc(`data:audio/mpeg;base64,${data.audio_base64}`)
      setListenState('ready')
    } catch (err) {
      setListenError(err.message)
      setListenState('error')
    }
  }

  function handlePlayPauseClick() {
    if (!audioSrc) {
      handleListen()
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setAutoplayBlocked(true))
    } else {
      audio.pause()
    }
  }

  function strategyLabel(key) {
    const labelKey = STRATEGY_LABEL_KEY[key]
    return labelKey ? t(labelKey) : key
  }

  async function handleCopy() {
    if (!result?.answer_text) return
    try {
      await navigator.clipboard.writeText(result.answer_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard API unavailable — nothing to fall back to gracefully here.
    }
  }

  const showFooter = status === 'success' && result && !result.refused && frontendLatencyMs != null

  return (
    <section id="answer" className="answer-card" data-status={status} aria-labelledby="answer-heading">
      <div className="answer-card__head">
        <h2 id="answer-heading" className="answer-card__title">
          {t('answer.title')}
        </h2>
        {status === 'success' && result && !result.refused && (
          <span className={`answer-card__status-badge${result.grounded ? ' is-grounded' : ''}`}>
            <span className="answer-card__status-dot" aria-hidden="true" />
            {result.grounded ? t('answer.groundedLabel') : t('answer.answerFallbackLabel')}
          </span>
        )}
      </div>

      <div className="answer-card__body">
        {status === 'idle' && (
          <p className="empty-state">
            <WaveformIcon className="empty-state__icon" width={18} height={18} />
            {t('answer.empty')}
          </p>
        )}

        {status === 'loading' && (
          <div className="answer-skeleton" aria-hidden="true">
            <div className="skeleton-line skeleton-line--short" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
          </div>
        )}

        {status === 'error' && (
          <div className="error-state">
            <AlertIcon className="error-state__icon" />
            <div>
              <p className="error-state__title">{t('answer.connectionUnavailable')}</p>
              <p className="error-state__body">{friendlyError(error, t)}</p>
            </div>
            <button type="button" className="btn btn--primary" onClick={onRetry}>
              <RefreshIcon /> {t('answer.tryAgain')}
            </button>
          </div>
        )}

        {status === 'success' && result && (
          <div className="answer-content">
            {!result.refused && (
              <div className="answer-card__meta">
                <span className="answer-card__meta-chip">
                  <WaveformIcon width={13} height={13} />
                  {language?.label || 'English'}
                </span>
              </div>
            )}

            <div className="answer-block">
              <span className="answer-label">{t('answer.youAsked')}</span>
              <p className="answer-query">{result.query_text || t('answer.noSpeechDetected')}</p>
            </div>

            {result.refused ? (
              <div className="answer-block answer-block--refused">
                <span className="answer-label">{t('answer.blockedLabel')}</span>
                <p>{result.answer_text}</p>
                {result.refusal_reason && (
                  <p className="answer-reason">
                    <span className="answer-reason-tag">{t('answer.guardrailLabel')}</span> {result.refusal_reason}
                  </p>
                )}
              </div>
            ) : (
              <div className={`answer-block${result.grounded ? ' answer-block--grounded' : ' answer-block--fallback'}`}>
                <span className="answer-label">
                  {result.grounded ? t('answer.answerLabel') : t('answer.answerFallbackLabel')}
                </span>
                <p className="answer-text">{result.answer_text}</p>
                {!result.grounded && result.fallback_reason && (
                  <p className="answer-reason">
                    <span className="answer-reason-tag">{t('answer.fallbackReasonLabel')}</span> {result.fallback_reason}
                  </p>
                )}
              </div>
            )}

            {result.selected_strategy && (
              <details className="answer-source">
                <summary>{t('answer.sourceDetails')}</summary>
                <span className="answer-label">{t('answer.chunkingStrategyUsed')}</span>
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
              </details>
            )}

            {audioSrc && (
              <audio
                ref={audioRef}
                src={audioSrc}
                className="answer-audio-hidden"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              >
                {t('answer.noAudioSupport')}
              </audio>
            )}

            <div className="answer-actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={handlePlayPauseClick}
                disabled={listenState === 'loading'}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
                {listenState === 'loading' ? 'Synthesizing…' : isPlaying ? t('answer.pause') : t('answer.listen')}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleCopy}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? t('answer.copied') : t('answer.copy')}
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={onAskAgain}>
                <RefreshIcon /> {t('answer.askAgain')}
              </button>
            </div>

            {listenState === 'error' && (
              <p className="answer-reason" role="alert">
                {listenError}
              </p>
            )}

            {autoplayBlocked && (
              <p className="answer-reason" role="status">
                {t('answer.autoplayBlocked')}
              </p>
            )}
          </div>
        )}
      </div>

      {showFooter && (
        <div className="answer-card__footer">
          <span className="answer-card__footer-label">{t('ask.panelLatency')}</span>
          <span className="answer-card__footer-values">
            <span className="answer-card__footer-value">{formatResponseTime(frontendLatencyMs)}</span>
            <span className="answer-card__footer-target">{t('ask.latencyTarget')}</span>
          </span>
        </div>
      )}
    </section>
  )
}

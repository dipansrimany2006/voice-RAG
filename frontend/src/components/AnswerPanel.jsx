import { useEffect, useRef, useState } from 'react'
import { polishAnswer, speak } from '../api'
import { PlayIcon, PauseIcon, CopyIcon, CheckIcon, RefreshIcon, AlertIcon, WaveformIcon } from './Icons'
import { friendlyError } from '../errorMessages'
import LatencyPanel, { SessionMetrics } from './LatencyPanel'
import { useLanguage } from '../i18n/LanguageContext'

const STRATEGY_LABEL_KEY = {
  fixed_overlap: 'answer.strategyFixedOverlap',
  semantic: 'answer.strategySemantic',
  metadata_aware: 'answer.strategyMetadataAware',
}

// The dominant workspace of the /app page — response, session
// performance, and per-query retrieval diagnostics all live here as one
// flat, structured area. No floating card, no glass panel: this section
// sits directly in the page's own background.
export default function AnswerPanel({ status, result, error, onRetry, onAskAgain, language, frontendLatencyMs, latencyHistory = [] }) {
// Per-stage latency breakdown, in pipeline order. Stages with no translated
// label (finer-grained than the existing pipeline.* keys) use a plain
// English technical name, same precedent as the "refining…" indicator.
const STAGE_LABELS = [
  ['stt', (t) => t('pipeline.latencySTT')],
  ['input_guardrail', () => 'Input guardrail'],
  ['embed_query', () => 'Embed query'],
  ['vector_search', () => 'Vector search'],
  ['retrieval_guardrail', () => 'Retrieval guardrail'],
  ['tts', () => 'TTS'],
  ['generate', (t) => t('pipeline.latencyGeneration')],
  ['fallback_generate', () => 'Fallback generation'],
  ['grounding_guardrail', () => 'Grounding check'],
]

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
  // Tracks whether the voice reply has finished at least once — separate
  // from isPlaying so "Speaking…" and "Voice response complete" read as
  // two distinct real moments rather than one boolean doing both jobs.
  const [voiceDone, setVoiceDone] = useState(false)
  // The fast path returns an extractive answer immediately; polishState
  // tracks the background LLM-refined answer fetched separately so the
  // initial response never waits on it.
  const [polishState, setPolishState] = useState('idle') // idle | loading | ready | error
  const [polished, setPolished] = useState(null)

  // A new query came in — forget any previously synthesized audio/polish so
  // the Listen button and the extractive->polished swap start fresh instead
  // of carrying over state from the last answer.
  useEffect(() => {
    setListenState('idle')
    setAudioSrc(null)
    setListenError(null)
    setIsPlaying(false)
    setAutoplayBlocked(false)
    setVoiceDone(false)
  }, [result?.answer_text])
    setPolishState('idle')
    setPolished(null)
  }, [result?.query_text])

  // Auto-fire the LLM polish request in the background as soon as the fast
  // extractive answer is shown, same on-demand-off-critical-path pattern
  // already used for TTS (see handleListen below) but fired automatically
  // instead of on click, since the polished answer should just arrive.
  useEffect(() => {
    if (status !== 'success' || !result || result.refused || result.answer_source !== 'extractive') return
    let cancelled = false
    setPolishState('loading')
    polishAnswer({ text: result.query_text })
      .then((data) => {
        if (!cancelled) {
          setPolished(data)
          setPolishState('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setPolishState('error')
      })
    return () => {
      cancelled = true
    }
  }, [status, result])

  // Polished text just replaced the extractive text — any audio already
  // synthesized for the extractive answer no longer matches what's shown.
  useEffect(() => {
    if (polishState !== 'ready') return
    setListenState('idle')
    setAudioSrc(null)
    setIsPlaying(false)
  }, [polishState])

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
    const textToSpeak = polishState === 'ready' && polished ? polished.answer_text : result?.answer_text
    if (!textToSpeak) return
    setListenState('loading')
    setListenError(null)
    try {
      const data = await speak({ text: textToSpeak })
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
    const textToCopy = polishState === 'ready' && polished ? polished.answer_text : result?.answer_text
    if (!textToCopy) return
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard API unavailable — nothing to fall back to gracefully here.
    }
  }

  // A coarse three-state read for the header's status dot — loading maps
  // to "processing", a landed answer to "complete", everything else
  // (idle, error) to "ready". The error state's own detail still shows
  // in the body below; the dot is deliberately just a quick glance.
  const dotState = status === 'loading' ? 'processing' : status === 'success' ? 'complete' : 'ready'
  const dotLabel =
    dotState === 'processing' ? t('pipeline.statusProcessing') : dotState === 'complete' ? t('pipeline.statusComplete') : t('pipeline.statusReady')
  const showFooter = status === 'success' && result && !result.refused && frontendLatencyMs != null
  // Extractive answer shows immediately; once the background LLM polish
  // resolves, swap the displayed text/grounding over to it.
  const displayed = polishState === 'ready' && polished ? polished : result
  const isRefining = status === 'success' && result && !result.refused && polishState === 'loading'

  return (
    <section id="answer" className="workspace__response" data-status={status} aria-labelledby="answer-heading">
      <div className="workspace__response-head">
        <h2 id="answer-heading" className="workspace__response-title">
          {t('answer.workspaceTitle')}
        </h2>
        <span className={`workspace__response-status workspace__response-status--${dotState}`}>
          <span className="workspace__response-status-dot" aria-hidden="true" />
          {dotLabel}
        </span>
        {status === 'success' && result && !result.refused && (
          <span className={`answer-card__status-badge${displayed.grounded ? ' is-grounded' : ''}`}>
            <span className="answer-card__status-dot" aria-hidden="true" />
            {displayed.grounded ? t('answer.groundedLabel') : t('answer.answerFallbackLabel')}
            {isRefining && <span className="answer-card__refining"> · refining…</span>}
          </span>
        )}
      </div>

      {/* the session performance strip is a persistent fixture, not tied
          to the current query — once at least one real query has
          completed this session, it stays visible through every
          subsequent idle/loading/success cycle */}
      {latencyHistory.length > 0 && <SessionMetrics history={latencyHistory} />}

      <div className="workspace__response-body">
        {status === 'idle' && (
          <div className="empty-state">
            <WaveformIcon className="empty-state__icon" width={18} height={18} />
            <p className="empty-state__title">{t('answer.empty')}</p>
            <p className="empty-state__hint">{t('answer.emptyHint')}</p>
          </div>
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
                <span className={`answer-card__status-badge${result.grounded ? ' is-grounded' : ''}`}>
                  {result.grounded ? <CheckIcon width={12} height={12} /> : <AlertIcon width={12} height={12} />}
                  {result.grounded ? t('answer.groundedLabel') : t('answer.answerFallbackLabel')}
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
              <div className={`answer-block${displayed.grounded ? ' answer-block--grounded' : ' answer-block--fallback'}`}>
                <span className="answer-label">
                  {displayed.grounded ? t('answer.answerLabel') : t('answer.answerFallbackLabel')}
                </span>
                <p className="answer-text">{displayed.answer_text}</p>
                {!displayed.grounded && displayed.fallback_reason && (
                  <p className="answer-reason">
                    <span className="answer-reason-tag">{t('answer.fallbackReasonLabel')}</span> {displayed.fallback_reason}
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

            {result.trace_ms && (
              <details className="answer-source">
                <summary>{t('pipeline.latencyTitle')}</summary>

                <span className="answer-label">{t('answer.answerLabel')} (instant, {result.answer_source || 'extractive'})</span>
                <ul className="strategy-scores">
                  {STAGE_LABELS.filter(([key]) => result.trace_ms[key] != null).map(([key, label]) => (
                    <li key={key}>
                      {label(t)}: {formatResponseTime(result.trace_ms[key])}
                    </li>
                  ))}
                  <li>
                    <strong>
                      {t('pipeline.latencyTotal')}: {formatResponseTime(result.total_ms)}
                    </strong>
                  </li>
                </ul>
                <p className="answer-strategy">
                  <span className={`badge ${result.retrieval_under_200ms ? 'badge--ok' : 'badge--warn'}`}>
                    {result.retrieval_under_200ms ? t('pipeline.retrievalUnder') : t('pipeline.retrievalOver')}
                  </span>
                </p>

                {polishState === 'ready' && polished?.trace_ms && (
                  <>
                    <span className="answer-label">{t('pipeline.stageLlm')} (polished)</span>
                    <ul className="strategy-scores">
                      {STAGE_LABELS.filter(([key]) => polished.trace_ms[key] != null).map(([key, label]) => (
                        <li key={key}>
                          {label(t)}: {formatResponseTime(polished.trace_ms[key])}
                        </li>
                      ))}
                      <li>
                        <strong>
                          {t('pipeline.latencyTotal')}: {formatResponseTime(polished.total_ms)}
                        </strong>
                      </li>
                    </ul>
                  </>
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
                onEnded={() => {
                  setIsPlaying(false)
                  setVoiceDone(true)
                }}
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

            {/* real TTS playback state — never a decorative loop, only
                ever visible while audio is genuinely playing or has
                genuinely just finished */}
            {isPlaying && (
              <p className="answer-voice-status" role="status">
                <span className="answer-voice-status__bars" aria-hidden="true">
                  <span /><span /><span />
                </span>
                {t('answer.speakingLabel')}
              </p>
            )}
            {!isPlaying && voiceDone && (
              <p className="answer-voice-status answer-voice-status--done" role="status">
                <CheckIcon width={13} height={13} />
                {t('answer.voiceCompleteLabel')}
              </p>
            )}

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

            {/* the current query's own real retrieval/generation
                breakdown — renders nothing when refused, so a blocked
                query never shows a technical row with no meaning */}
            <LatencyPanel status={status} result={result} frontendLatencyMs={frontendLatencyMs} />

            {!result.refused && (
              <div className="evidence">
                <span className="evidence__title">{t('answer.sourceDetails')}</span>
                {result.strategy_scores ? (
                  Object.entries(result.strategy_scores)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, score], i) => (
                      <div className="evidence__row" key={name} style={{ '--i': i }}>
                        <span className="evidence__index">{String(i + 1).padStart(2, '0')}</span>
                        <span className="evidence__name">{strategyLabel(name)}</span>
                        <span className="evidence__score">{score.toFixed(3)}</span>
                      </div>
                    ))
                ) : (
                  <p className="evidence__empty">{t('answer.noEvidence')}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

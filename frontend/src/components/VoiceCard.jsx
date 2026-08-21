import { useState } from 'react'
import ProcessingPipeline from './ProcessingPipeline'
import { HoloMic, SendIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// The /app workspace — one centered voice-assistant surface: a single
// animated orb as the primary mic control (idle/listening/processing/
// speaking all read from the same real state the old separate mic
// button + waveform bar used), the text fallback below it, then the
// Response area. No floating glass panels, no separate "intro" block.
export default function VoiceCard({
  recording,
  micDisabled,
  micStatusText,
  micHintVisible,
  onMicClick,
  elapsedSeconds,
  textInput,
  onTextInputChange,
  onTextSubmit,
  sampleQueries = [],
  onSampleQueryClick,
  ready,
  loading,
  resultReady,
  hasError,
  systemSpeaking,
  answerSlot,
}) {
  const { t } = useLanguage()
  // Purely decorative — a fresh key per click remounts the ripple span so
  // its CSS animation replays every time, with no timers to clean up (it
  // just sits at 0 opacity once the animation finishes). Never touches
  // the real onClick below; it only rides alongside it.
  const [rippleId, setRippleId] = useState(0)

  const orbState = recording
    ? 'listening'
    : systemSpeaking
    ? 'speaking'
    : loading
    ? 'processing'
    : hasError
    ? 'error'
    : 'idle'

  const queryStatus = loading ? 'loading' : resultReady ? 'success' : hasError ? 'error' : 'idle'

  const statusText = recording
    ? `${formatTimer(elapsedSeconds)} · ${t('ask.listening')}`
    : systemSpeaking
    ? t('answer.speakingLabel')
    : loading
    ? t('ask.processing')
    : t('ask.tapToSpeak')

  function handleOrbClick(e) {
    setRippleId((id) => id + 1)
    onMicClick(e)
  }

  return (
    <section id="ask" className="workspace workspace--voice" data-listening={recording} aria-labelledby="ask-heading">
      <h2 id="ask-heading" className="sr-only">
        {t('ask.title')}
      </h2>

      <div className="voice-stage">
        <button
          type="button"
          className={`voice-orb voice-orb--${orbState}`}
          aria-pressed={recording}
          aria-label={recording ? t('a11y.stopRecording') : t('a11y.startRecording')}
          disabled={micDisabled}
          onClick={handleOrbClick}
        >
          <span className="voice-orb__glow" aria-hidden="true" />
          <span className="voice-orb__core" aria-hidden="true">
            <span className="voice-orb__blob voice-orb__blob--1" />
            <span className="voice-orb__blob voice-orb__blob--2" />
            <span className="voice-orb__blob voice-orb__blob--3" />
            <span className="voice-orb__highlight" />
          </span>
          <span className="voice-orb__icon" aria-hidden="true">
            <HoloMic width={72} height={72} />
          </span>
          {rippleId > 0 && <span key={rippleId} className="voice-orb__ripple" aria-hidden="true" />}
        </button>

        <p className="voice-stage__title">{t('ask.voiceOrText')}</p>
        <p className="voice-stage__status" role="status" aria-live="polite">
          {statusText}
        </p>

        {micHintVisible && <p className="workspace__hint">{micStatusText}</p>}
      </div>

      {sampleQueries.length > 0 && (
        <div className="workspace__samples" role="group" aria-label={t('ask.sampleQueriesLabel')}>
          <span className="workspace__samples-label">{t('ask.sampleQueriesLabel')}</span>
          <div className="workspace__samples-list">
            {sampleQueries.map((sample, i) => (
              <button
                key={i}
                type="button"
                className="workspace__sample-chip"
                disabled={loading}
                onClick={() => onSampleQueryClick(sample.text)}
                title={sample.language}
              >
                {sample.text}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="workspace__form workspace__form--centered" onSubmit={onTextSubmit}>
        <input
          type="text"
          id="text-input"
          autoComplete="off"
          placeholder={t('ask.placeholderKnowledgeBase')}
          value={textInput}
          onChange={(e) => onTextInputChange(e.target.value)}
        />
        <button type="submit" className="btn btn--primary btn--sm" disabled={!ready || loading}>
          <SendIcon />
          <span>{t('ask.askButton')}</span>
        </button>
      </form>

      <ProcessingPipeline status={queryStatus} />

      {answerSlot}
    </section>
  )
}

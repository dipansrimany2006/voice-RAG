import MicButton from './MicButton'
import VoiceWave from './VoiceWave'
import { SendIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function VoiceCard({
  recording,
  micDisabled,
  micStatusText,
  micHintVisible,
  onMicClick,
  micStream,
  elapsedSeconds,
  language,
  voiceMode,
  onVoiceModeChange,
  textInput,
  onTextInputChange,
  onTextSubmit,
  ready,
  loading,
  resultReady,
  answerSlot,
}) {
  const { t } = useLanguage()

  const orbState = recording ? 'listening' : loading ? 'processing' : resultReady ? 'answered' : 'idle'

  return (
    <section id="ask" className="voice-card" data-listening={recording} aria-labelledby="ask-heading">
      <div className="voice-card__ambient" aria-hidden="true">
        <span className="voice-card__ambient-dot voice-card__ambient-dot--1" />
        <span className="voice-card__ambient-dot voice-card__ambient-dot--2" />
        <span className="voice-card__ambient-dot voice-card__ambient-dot--3" />
        <span className="voice-card__ambient-dot voice-card__ambient-dot--4" />
        <span className="voice-card__ambient-lines" />
      </div>

      <div className="voice-card__stage-grid">
        <div className="voice-card__panel voice-card__panel--intro">
          <span className="badge badge--live">
            <span className="badge__dot" aria-hidden="true" />
            {t('ask.live')}
          </span>
          <h2 id="ask-heading" className="voice-card__title">
            {t('ask.title')}
          </h2>
          <p className="voice-card__lead">{t('ask.lead')}</p>

          <div className="voice-card__controls">
            {/* language selection lives only in the navbar's global dropdown
                now — this used to duplicate it with a second select here */}
            <label className="voice-card__field voice-mode">
              <span className="voice-card__field-label">{t('ask.voiceReply')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={voiceMode}
                className={`toggle${voiceMode ? ' is-on' : ''}`}
                onClick={() => onVoiceModeChange(!voiceMode)}
              >
                <span className="toggle__thumb" />
              </button>
            </label>
          </div>
        </div>

        <div className="voice-card__panel voice-card__panel--stage">
          <div className="voice-stage voice-stage--focus">
            <div className="voice-stage__orb-frame">
              <VoiceWave size="stage" state={orbState} stream={micStream} className="voice-stage__orb" />
              <div className="voice-stage__mic-wrap">
                <MicButton recording={recording} processing={loading} disabled={micDisabled} onClick={onMicClick} />
              </div>
            </div>
            <p className="voice-stage__status" role="status" aria-live="polite">
              {recording ? t('ask.listening') : loading ? t('ask.processing') : t('ask.tapToSpeak')}
            </p>
            {recording && (
              <p className="voice-stage__timer" aria-hidden="true">
                {formatTimer(elapsedSeconds)}
              </p>
            )}
            {/* the idle default ("recognizes all 14 languages...") is dropped —
                the language selector already says that; real states (an
                actual recorder error, unsupported-browser notice, or the
                recording-in-progress hint) still show through */}
            {micHintVisible && <p className="voice-stage__hint">{micStatusText}</p>}
          </div>
        </div>

        <div className="voice-card__panel voice-card__panel--answer">{answerSlot}</div>

        <div className="voice-card__panel voice-card__panel--textform">
          <div className="voice-card__divider">
            <span>{t('ask.orType')}</span>
          </div>

          <form className="text-form" onSubmit={onTextSubmit}>
            <div className="text-form-row">
              <input
                type="text"
                id="text-input"
                autoComplete="off"
                placeholder={language.example}
                value={textInput}
                onChange={(e) => onTextInputChange(e.target.value)}
              />
              <button type="submit" className="btn btn--primary btn--icon" disabled={!ready || loading}>
                <SendIcon />
                <span>{t('ask.askButton')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

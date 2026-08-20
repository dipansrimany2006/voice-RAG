import MicButton from './MicButton'
import MiniWaveform from './MiniWaveform'
import ProcessingPipeline from './ProcessingPipeline'
import { SendIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// The /app workspace — a compact command bar (mic + a small real
// waveform + status, text input as the fallback) sitting directly above
// the Response area, which does the actual visual work. No floating
// glass panels, no dedicated "intro" copy block: just the controls
// needed to ask a question, then the answer.
export default function VoiceCard({
  recording,
  micDisabled,
  micStatusText,
  micHintVisible,
  onMicClick,
  micStream,
  elapsedSeconds,
  textInput,
  onTextInputChange,
  onTextSubmit,
  ready,
  loading,
  resultReady,
  hasError,
  answerSlot,
}) {
  const { t } = useLanguage()

  const waveState = recording ? 'listening' : loading ? 'processing' : hasError ? 'error' : resultReady ? 'answered' : 'idle'
  const queryStatus = loading ? 'loading' : resultReady ? 'success' : hasError ? 'error' : 'idle'

  return (
    <section id="ask" className="workspace" data-listening={recording} aria-labelledby="ask-heading">
      <h2 id="ask-heading" className="sr-only">
        {t('ask.title')}
      </h2>

      <div className="workspace__bar">
        <div className="workspace__voice">
          <MicButton recording={recording} processing={loading} disabled={micDisabled} onClick={onMicClick} compact />
          <MiniWaveform state={waveState} stream={micStream} />
          <span className="workspace__voice-status" role="status" aria-live="polite">
            {recording ? `${formatTimer(elapsedSeconds)} · ${t('ask.listening')}` : loading ? t('ask.processing') : t('ask.tapToSpeak')}
          </span>
        </div>

        <form className="workspace__form" onSubmit={onTextSubmit}>
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
      </div>

      {micHintVisible && <p className="workspace__hint">{micStatusText}</p>}

      <ProcessingPipeline status={queryStatus} />

      {answerSlot}
    </section>
  )
}

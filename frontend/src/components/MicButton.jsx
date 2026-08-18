import { MicIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'

export default function MicButton({ recording, processing, disabled, onClick }) {
  const { t } = useLanguage()
  const isProcessing = processing && !recording

  return (
    <div
      className={`mic-stage${recording ? ' is-recording' : ''}${isProcessing ? ' is-processing' : ''}`}
    >
      <span className="mic-idle-glow" aria-hidden="true" />
      <span className="mic-idle-ring mic-idle-ring--1" aria-hidden="true" />
      <span className="mic-idle-ring mic-idle-ring--2" aria-hidden="true" />

      {recording && (
        <>
          <span className="mic-ring mic-ring--1" aria-hidden="true" />
          <span className="mic-ring mic-ring--2" aria-hidden="true" />
          <span className="mic-ring mic-ring--3" aria-hidden="true" />
        </>
      )}

      {isProcessing && (
        <span className="mic-orbit" aria-hidden="true">
          <span className="mic-orbit__dot" />
        </span>
      )}

      <button
        type="button"
        className={`mic-button${recording ? ' mic-button--recording' : ''}${isProcessing ? ' mic-button--processing' : ''}`}
        aria-pressed={recording}
        aria-busy={isProcessing}
        aria-label={recording ? t('a11y.stopRecording') : t('a11y.startRecording')}
        disabled={disabled}
        onClick={onClick}
      >
        <span className="mic-icon" aria-hidden="true">
          <MicIcon width={30} height={30} />
        </span>
      </button>

      {recording && (
        <div className="mic-waveform" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="mic-waveform__bar" style={{ '--i': i }} />
          ))}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { HoloMic } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'

export default function MicButton({ recording, processing, disabled, onClick, compact = false }) {
  const { t } = useLanguage()
  const isProcessing = processing && !recording
  // Purely decorative — a fresh key per click remounts the ripple span so
  // its CSS animation replays every time, with no timers to clean up (it
  // just sits at 0 opacity once the animation finishes). Never touches
  // the real onClick below; it only rides alongside it.
  const [rippleId, setRippleId] = useState(0)

  function handleClick(e) {
    setRippleId((id) => id + 1)
    onClick(e)
  }

  return (
    <div
      className={`mic-stage${compact ? ' mic-stage--compact' : ''}${recording ? ' is-recording' : ''}${isProcessing ? ' is-processing' : ''}`}
    >
      {/* the decorative rings/glow (idle breathing rings, recording pulse
          rings, processing rings) exist for the full-size button; the
          compact bar-context button skips all of them — just the button,
          the icon, and the click ripple, no rings of any kind. The
          adjacent MiniWaveform carries "voice activity" instead. */}
      {!compact && (
        <>
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
            <span className="mic-processing-glow" aria-hidden="true">
              <span className="mic-processing-ring mic-processing-ring--1" />
              <span className="mic-processing-ring mic-processing-ring--2" />
              <span className="mic-processing-ring mic-processing-ring--3" />
            </span>
          )}
        </>
      )}

      <button
        type="button"
        className={`mic-button${compact ? ' mic-button--compact' : ''}${recording ? ' mic-button--recording' : ''}${isProcessing ? ' mic-button--processing' : ''}`}
        aria-pressed={recording}
        aria-busy={isProcessing}
        aria-label={recording ? t('a11y.stopRecording') : t('a11y.startRecording')}
        disabled={disabled}
        onClick={handleClick}
      >
        <span className="mic-icon" aria-hidden="true">
          <HoloMic width={compact ? 17 : 26} height={compact ? 17 : 26} />
        </span>
        {rippleId > 0 && <span key={rippleId} className="mic-click-ripple" aria-hidden="true" />}
      </button>

      {!compact && recording && (
        <div className="mic-waveform" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="mic-waveform__bar" style={{ '--i': i }} />
          ))}
        </div>
      )}
    </div>
  )
}

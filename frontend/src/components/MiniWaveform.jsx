import { useRef } from 'react'
import { useAudioLevels } from '../useAudioLevels'

const BAR_COUNT = 12

// A small, genuinely audio-reactive waveform for the compact command bar
// — real per-frequency-bucket levels from the live microphone stream
// (the same analyser technique VoiceWave.jsx uses), written straight to
// each bar's own style so 60fps updates never trigger a re-render. Idle,
// processing, and answered are plain CSS; only 'listening' with a real
// stream ever drives this JS path. No rings, no orb — just bars.
export default function MiniWaveform({ state = 'idle', stream = null }) {
  const barRefs = useRef([])
  const audioActive = state === 'listening' && Boolean(stream)

  useAudioLevels(stream, BAR_COUNT, audioActive, (levels) => {
    barRefs.current.forEach((bar, i) => {
      if (!bar) return
      if (levels) {
        const v = levels[i] ?? 0
        bar.style.transform = `scaleY(${(0.3 + v * 1.3).toFixed(2)})`
        bar.style.opacity = (0.55 + v * 0.45).toFixed(2)
      } else {
        bar.style.transform = ''
        bar.style.opacity = ''
      }
    })
  })

  return (
    <div className="mini-wave" data-wave-state={state} aria-hidden="true">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span key={i} ref={(el) => (barRefs.current[i] = el)} className="mini-wave__bar" style={{ '--i': i }} />
      ))}
    </div>
  )
}

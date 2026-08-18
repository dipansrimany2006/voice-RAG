import { useEffect, useRef } from 'react'

// How many animation frames the post-recording "settle" eases over — a
// real voice visualizer relaxes back to rest, it doesn't cut instantly.
const DECAY_FRAMES = 18

// Samples real microphone volume from an already-open MediaStream (the
// same stream useRecorder's MediaRecorder is reading — this only taps it
// via a second, read-only AnalyserNode, it never touches or interrupts
// the actual recording) and reports it as `barCount` frequency-bucket
// levels (0..1) once per animation frame via `onFrame`. Delivered through
// a callback rather than React state so 60fps updates never trigger a
// re-render — the caller is expected to write levels straight to refs.
//
// `onFrame` receives `null` once to signal "audio sampling has fully
// stopped, hand visual control back to CSS" — both when `active` goes
// false and after the brief settle decay finishes.
export function useAudioLevels(stream, barCount, active, onFrame) {
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    if (!active || !stream) return undefined

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return undefined

    let audioCtx
    try {
      audioCtx = new AudioContextClass()
    } catch {
      return undefined
    }

    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.7
    source.connect(analyser)

    const freqData = new Uint8Array(analyser.frequencyBinCount)
    const bucketSize = Math.max(1, Math.floor(freqData.length / barCount))
    const levels = new Array(barCount).fill(0)
    let rafId
    let cancelled = false

    function sample() {
      analyser.getByteFrequencyData(freqData)
      for (let i = 0; i < barCount; i++) {
        let sum = 0
        const start = i * bucketSize
        for (let j = 0; j < bucketSize; j++) sum += freqData[start + j] || 0
        levels[i] = sum / bucketSize / 255
      }
      onFrameRef.current?.(levels)
      if (!cancelled) rafId = requestAnimationFrame(sample)
    }
    rafId = requestAnimationFrame(sample)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      source.disconnect()
      analyser.disconnect()
      audioCtx.close().catch(() => {})

      let frame = 0
      function decay() {
        frame += 1
        const t = frame / DECAY_FRAMES
        if (t >= 1) {
          onFrameRef.current?.(null)
          return
        }
        onFrameRef.current?.(levels.map((v) => v * (1 - t)))
        requestAnimationFrame(decay)
      }
      requestAnimationFrame(decay)
    }
  }, [stream, active, barCount])
}

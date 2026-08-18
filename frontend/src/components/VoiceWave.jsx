import { useMemo, useRef } from 'react'
import { MicIcon } from './Icons'
import { useAudioLevels } from '../useAudioLevels'

// Voice RAG's signature visual — an organic, continuously-morphing glass
// blob wrapped around the mic, glowing blue-to-magenta at its rim, with
// a soft ambient glow, a few floating motes further out, and small glass
// bubbles drifting around it. The literal backdrop the real mic button
// sits inside on the voice interaction page. `state` mirrors the
// interaction lifecycle (idle/listening/processing/answered); this
// component never touches recording logic, it only reacts to it.
//
// The blob is data-driven the same way in both states, just from a
// different data source: at rest its `d` is animated by an ordinary CSS
// keyframe cycling between three gently-lobed shapes (see
// voicewave-blob-idle in index.css); the instant a live `stream` is
// supplied and state is 'listening', that CSS animation is switched off
// (via [data-audio-live]) and the exact same path format is instead
// redrawn every animation frame straight from real microphone volume
// (via useAudioLevels) — 24 frequency buckets interpolated into a smooth
// closed shape, written directly to the path's `d` attribute so it stays
// at 60fps without going through React state.
const AUDIO_BUCKET_COUNT = 24
const MOTE_COUNT = 14
const BUBBLE_COUNT = 8
const FLOW_STEPS_PER_BUCKET = 8
const BLOB_BASE_R = 62
const BLOB_IDLE_AMP = 14
const BLOB_LISTEN_AMP = 34

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

// each mote gets its own depth roll — closer ones sit further out, bigger,
// brighter and sharper; farther ones sit tighter to the ring, smaller,
// dimmer and softer — the field reads as occupying real volume around the
// Core rather than a flat ring of identical dots
function makeMotes(seed) {
  const rand = seeded(seed)
  return Array.from({ length: MOTE_COUNT }, (_, i) => {
    const angle = (i / MOTE_COUNT) * Math.PI * 2 + rand() * 0.5
    const depth = rand()
    const radius = 42 + depth * 12
    return {
      id: i,
      left: (50 + Math.cos(angle) * radius).toFixed(1),
      top: (50 + Math.sin(angle) * radius).toFixed(1),
      size: (1.1 + depth * 2.1).toFixed(1),
      opacity: (0.35 + depth * 0.5).toFixed(2),
      blur: (1.6 - depth * 1.6).toFixed(1),
      duration: (7 + rand() * 6).toFixed(1),
      delay: (-(rand() * 10)).toFixed(1),
    }
  })
}

// A handful of small glass bubbles orbiting just outside the blob's rim —
// same "highlight + tinted fade" glass look as the Home hero's bubble
// field, scaled down to sit around this one component instead of a
// whole viewport.
function makeBubbles(seed) {
  const rand = seeded(seed)
  const tones = ['violet', 'magenta', 'blue']
  return Array.from({ length: BUBBLE_COUNT }, (_, i) => {
    const angle = rand() * Math.PI * 2
    const radius = 44 + rand() * 14
    const depth = rand()
    return {
      id: i,
      tone: tones[i % tones.length],
      left: (50 + Math.cos(angle) * radius).toFixed(1),
      top: (50 + Math.sin(angle) * radius).toFixed(1),
      size: (4 + depth * 8).toFixed(1),
      opacity: (0.18 + depth * 0.28).toFixed(2),
      duration: (6 + rand() * 6).toFixed(1),
      delay: (-(rand() * 12)).toFixed(1),
    }
  })
}

// Builds a smooth closed blob path from N amplitude buckets (0..1 each) —
// linear interpolation between buckets at a high step count reads as a
// flowing organic curve rather than a jagged polygon, no bezier math
// needed. Used for both the idle sine-driven shapes and the real
// audio-driven ones, so the two always share the exact same command
// structure (required for the idle CSS `d` animation to interpolate).
function buildBlobPath(levels, cx, cy, baseR, maxAmp) {
  const n = levels.length
  const steps = n * FLOW_STEPS_PER_BUCKET
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const pos = (i / steps) * n
    const i0 = Math.floor(pos) % n
    const i1 = (i0 + 1) % n
    const frac = pos - Math.floor(pos)
    const level = levels[i0] + (levels[i1] - levels[i0]) * frac
    const r = baseR + level * maxAmp
    const x = (cx + r * Math.cos(t)).toFixed(2)
    const y = (cy + r * Math.sin(t)).toFixed(2)
    d += i === 0 ? `M${x},${y} ` : `L${x},${y} `
  }
  return `${d}Z`
}

// The resting shape actually rendered on first paint, before the idle CSS
// animation (see voicewave-blob-idle) takes over — same formula as that
// keyframe's own first stop, so there's no visible jump on mount.
const REST_LEVELS = Array.from({ length: AUDIO_BUCKET_COUNT }, (_, i) => {
  const t = (i / AUDIO_BUCKET_COUNT) * Math.PI * 2
  return 0.35 + 0.3 * Math.sin(t * 6)
})
const REST_BLOB_PATH = buildBlobPath(REST_LEVELS, 100, 100, BLOB_BASE_R, BLOB_IDLE_AMP)

export default function VoiceWave({ size = 'stage', state = 'idle', stream = null, className = '' }) {
  const motes = useMemo(() => makeMotes(7), [])
  const bubbles = useMemo(() => makeBubbles(53), [])
  const rootRef = useRef(null)
  const glowRef = useRef(null)
  const blobRef = useRef(null)
  const liveRef = useRef(false)

  const audioActive = state === 'listening' && Boolean(stream)

  useAudioLevels(stream, AUDIO_BUCKET_COUNT, audioActive, (levels) => {
    const root = rootRef.current
    if (levels) {
      if (!liveRef.current) {
        liveRef.current = true
        if (root) root.dataset.audioLive = 'true'
      }
      let sum = 0
      for (let i = 0; i < levels.length; i++) sum += levels[i]
      const avg = sum / levels.length
      if (glowRef.current) glowRef.current.style.transform = `scale(${(1 + avg * 0.3).toFixed(3)})`
      if (blobRef.current) blobRef.current.setAttribute('d', buildBlobPath(levels, 100, 100, BLOB_BASE_R, BLOB_LISTEN_AMP))
    } else if (liveRef.current) {
      liveRef.current = false
      if (root) delete root.dataset.audioLive
      if (glowRef.current) glowRef.current.style.transform = ''
      if (blobRef.current) blobRef.current.setAttribute('d', REST_BLOB_PATH)
    }
  })

  return (
    <div ref={rootRef} className={`voice-wave voice-wave--${size} ${className}`} data-wave-state={state} aria-hidden="true">
      <span ref={glowRef} className="voice-wave__glow" />

      <div className="voice-wave__motes">
        {motes.map((m) => (
          <span
            key={m.id}
            className="voice-wave__mote"
            style={{
              left: `${m.left}%`,
              top: `${m.top}%`,
              width: `${m.size}px`,
              height: `${m.size}px`,
              '--peak-opacity': m.opacity,
              '--blur': `${m.blur}px`,
              '--dur': `${m.duration}s`,
              '--delay': `${m.delay}s`,
            }}
          />
        ))}
      </div>

      {/* small glass bubbles orbiting just outside the blob's rim */}
      <div className="voice-wave__bubbles">
        {bubbles.map((b) => (
          <span
            key={b.id}
            className={`voice-wave__bubble voice-wave__bubble--${b.tone}`}
            style={{
              left: `${b.left}%`,
              top: `${b.top}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              '--peak-opacity': b.opacity,
              '--dur': `${b.duration}s`,
              '--delay': `${b.delay}s`,
            }}
          />
        ))}
      </div>

      <svg className="voice-wave__field" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="voice-wave-flow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--bright-green)" />
            <stop offset="50%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--gold)" />
          </linearGradient>
        </defs>
        {/* the signature liquid blob — see the file header for how its
            `d` handoff between the idle CSS animation and real audio
            works */}
        <path ref={blobRef} className="voice-wave__blob" d={REST_BLOB_PATH} />
        <circle className="voice-wave__ring voice-wave__ring--halo" cx="100" cy="100" r="46" />
      </svg>

      <div className="voice-wave__mic-wrap">
        <MicIcon className="voice-wave__mic" width={size === 'compact' ? 20 : 28} height={size === 'compact' ? 20 : 28} />
      </div>
    </div>
  )
}

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'voice-rag-sound-muted'
// 10-20% of normal volume, as specified — soft enough to be a texture,
// never a notification.
const VOLUME = 0.15

const SoundContext = createContext(null)

function getInitialMuted() {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

// A single lazily-created AudioContext for the whole session. It's only
// ever instantiated inside a real playSound() call, which itself only
// ever runs in response to an actual user-triggered app-state change
// (mic click, query start/finish) — so this satisfies every browser's
// autoplay-gesture requirement without any special-casing, and nothing
// plays before the visitor has done something.
let audioCtx = null
function getContext() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// One short oscillator + gain envelope — warm, soft attack, exponential
// decay. This is the entire "sound library": no files, no dependency.
function tone(ctx, { freqStart, freqEnd, duration, type = 'sine', gainPeak, delay = 0 }) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  const startTime = ctx.currentTime + delay
  osc.frequency.setValueAtTime(freqStart, startTime)
  if (freqEnd && freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), startTime + duration)
  }
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + duration * 0.18)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
}

// Each pattern is 150-500ms, a warm rising/falling sine or triangle
// sweep — deliberately far from a beep, chime, or notification sound.
const PATTERNS = {
  // mic click — a soft rising pulse, "waking up". This is the one cue
  // that must be clearly audible on click, so it floors at a fixed gain
  // rather than scaling off the same low base every ambient cue shares
  activate: (ctx, vol) => tone(ctx, { freqStart: 420, freqEnd: 720, duration: 0.22, gainPeak: Math.max(vol, 0.48) }),
  // recording has genuinely started — a very faint sustained-feeling
  // pulse, quieter than every other cue since it's ambient texture, not
  // a confirmation
  listening: (ctx, vol) => tone(ctx, { freqStart: 560, freqEnd: 600, duration: 0.35, type: 'sine', gainPeak: vol * 0.35 }),
  // recording stopped with real audio captured — a quick, quiet confirm
  detected: (ctx, vol) => tone(ctx, { freqStart: 640, freqEnd: 640, duration: 0.12, gainPeak: vol * 0.8 }),
  // query in flight (voice or text) — two soft ascending triangle notes
  retrieving: (ctx, vol) => {
    tone(ctx, { freqStart: 380, freqEnd: 520, duration: 0.16, type: 'triangle', gainPeak: vol * 0.7 })
    tone(ctx, { freqStart: 520, freqEnd: 640, duration: 0.16, type: 'triangle', gainPeak: vol * 0.7, delay: 0.09 })
  },
  // answer arrived — a brighter two-note settle, the "completion" cue
  answerReady: (ctx, vol) => {
    tone(ctx, { freqStart: 520, freqEnd: 780, duration: 0.16, gainPeak: vol })
    tone(ctx, { freqStart: 780, freqEnd: 1040, duration: 0.22, gainPeak: vol * 0.85, delay: 0.1 })
  },
  // recorder or API failure — a soft falling tone, not an alarm
  error: (ctx, vol) => tone(ctx, { freqStart: 300, freqEnd: 180, duration: 0.28, type: 'triangle', gainPeak: vol * 0.8 }),
}

// One provider for the whole app so the Header's mute toggle and every
// playSound() call (Hero, VoiceApp) always agree on the same state —
// no per-page hook instances to fall out of sync with each other.
export function SoundProvider({ children }) {
  const [muted, setMuted] = useState(getInitialMuted)
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(muted))
  }, [muted])

  const playSound = useCallback((name) => {
    if (mutedRef.current) return
    const pattern = PATTERNS[name]
    if (!pattern) return
    const ctx = getContext()
    if (!ctx) return
    try {
      pattern(ctx, VOLUME)
    } catch {
      // sound is decoration only — a synthesis failure must never affect
      // the real voice/RAG interaction it's narrating
    }
  }, [])

  const toggleMuted = useCallback(() => setMuted((m) => !m), [])

  const value = { muted, toggleMuted, playSound }
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}

export function useSound() {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error('useSound must be used within a SoundProvider')
  return ctx
}

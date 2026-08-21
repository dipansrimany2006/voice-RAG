import { useEffect, useRef, useState } from 'react'
import BeachScene from './BeachScene'
import { MicIcon, SparkleIcon, ShieldIcon, WaveformIcon, BoltIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'
import { useSound } from '../SoundContext'

// The horizontal feature rail beneath the Core — copy already existed in
// translations.js (`home.feature*`, full 14-language parity) from an
// earlier pass; only the presentation (a rail, not four cards) is new.
const FEATURES = [
  { id: 'lang', Icon: SparkleIcon, titleKey: 'home.featureLangTitle', bodyKey: 'home.featureLangBody' },
  { id: 'rag', Icon: ShieldIcon, titleKey: 'home.featureRagTitle', bodyKey: 'home.featureRagBody' },
  { id: 'voice', Icon: WaveformIcon, titleKey: 'home.featureVoiceTitle', bodyKey: 'home.featureVoiceBody' },
  { id: 'fast', Icon: BoltIcon, titleKey: 'home.featureFastTitle', bodyKey: 'home.featureFastBody' },
]

// A fixed, hand-shaped waveform silhouette for the Voice Wave Core — not
// audio-reactive (there's nothing recording on this page), just enough
// shape variation that it reads as organic activity rather than a
// uniform equalizer.
const WAVE_BARS = [26, 44, 32, 60, 38, 68, 46, 56, 34, 64, 50, 29, 72, 42, 58, 36, 66, 48, 31, 54]

// A handful of tiny particles at fixed positions around the core —
// varied sizes/radii so they read as scattered, not a ring.
const WAVE_PARTICLES = [
  { top: 6, left: 76, size: 3 },
  { top: 84, left: 16, size: 2 },
  { top: 58, left: 92, size: 2.5 },
  { top: 18, left: 4, size: 2 },
  { top: 94, left: 58, size: 2.5 },
  { top: 38, left: 96, size: 2 },
  { top: 2, left: 40, size: 2.5 },
  { top: 70, left: 26, size: 2 },
]

// The "audio intelligence trail" beneath the status label — small
// fragments drifting outward from centre and fading, symmetric left/
// right so it reads as a signal dispersing rather than a directional
// scan. `dist` is the resting offset from centre as a percentage of the
// trail's own width (so it stays correct at any of the trail's
// responsive widths).
const TRAIL_FRAGMENTS = [
  { side: -1, dist: 6, size: 2, tone: 'gold' },
  { side: 1, dist: 9, size: 2.5, tone: 'ivory' },
  { side: -1, dist: 15, size: 1.5, tone: 'gold' },
  { side: 1, dist: 19, size: 2, tone: 'gold' },
  { side: -1, dist: 25, size: 2.5, tone: 'ivory' },
  { side: 1, dist: 29, size: 1.5, tone: 'gold' },
  { side: -1, dist: 34, size: 2, tone: 'gold' },
  { side: 1, dist: 38, size: 1.5, tone: 'ivory' },
  { side: -1, dist: 42, size: 1.5, tone: 'gold' },
  { side: 1, dist: 45, size: 1.5, tone: 'gold' },
]

// A dozen tiny ambient particles scattered across the lower-mid hero,
// independent of the trail above — fixed positions, slow individual
// float, a few with a touch of horizontal sway.
const AMBIENT_PARTICLES = [
  { top: 10, left: 12, size: 1.5, tone: 'ivory', sway: false },
  { top: 65, left: 6, size: 2, tone: 'gold', sway: true },
  { top: 30, left: 92, size: 1.5, tone: 'gold', sway: false },
  { top: 80, left: 95, size: 2, tone: 'ivory', sway: true },
  { top: 4, left: 60, size: 1.5, tone: 'gold', sway: false },
  { top: 92, left: 38, size: 1.5, tone: 'ivory', sway: false },
  { top: 48, left: 3, size: 2, tone: 'gold', sway: true },
  { top: 20, left: 78, size: 1.5, tone: 'ivory', sway: false },
  { top: 88, left: 70, size: 1.5, tone: 'gold', sway: true },
  { top: 55, left: 98, size: 1.5, tone: 'gold', sway: false },
]

// The small status label beneath the Core — maps the real voice state to
// copy. Only 'idle' and 'listening' are actually reachable from this
// page today (handleStart below never sets 'processing'/'answered'),
// but the mapping covers every state data-voice-state can carry so nothing
// needs to change here if that ever wires up further.
const WAVE_LABEL_KEYS = {
  idle: 'hero.waveReady',
  listening: 'hero.listening',
  processing: 'hero.waveProcessing',
  retrieving: 'hero.waveRetrieving',
  answered: 'hero.waveGrounded',
}

// The landing-page hero — a centered headline + CTA over the deep-space
// backdrop (BeachScene). "Start Asking" plays a real "waking up" moment —
// the shared `listening` state BeachScene's own reactive layers (voice
// ripples) key off — before routing to the actual voice interface.
export default function Hero({ onStart, onHowItWorks }) {
  const { t, languageCode } = useLanguage()
  const { playSound } = useSound()
  const [voiceState, setVoiceState] = useState('idle')
  const [rippleId, setRippleId] = useState(0)
  const heroRef = useRef(null)
  const ctaRef = useRef(null)
  const waveRef = useRef(null)

  // Scroll fade and mouse parallax both write straight to CSS custom
  // properties on the `.hero` section itself, so every descendant —
  // BeachScene's background/midground/foreground layers, the text — can
  // read the same --mx/--my/--scrollp without each owning a duplicate
  // listener. Depth is entirely delegated to CSS (each element picks its
  // own multiplier), this effect only ever measures and writes.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = heroRef.current
    if (!el) return

    let scrollRaf = null
    function applyScroll() {
      scrollRaf = null
      const rect = el.getBoundingClientRect()
      const progress = Math.min(Math.max(-rect.top / Math.max(rect.height, 1), 0), 1)
      el.style.setProperty('--scrollp', progress.toFixed(3))
    }
    function handleScroll() {
      if (scrollRaf === null) scrollRaf = requestAnimationFrame(applyScroll)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    applyScroll()

    let pointerRaf = null
    let pendingMx = 0
    let pendingMy = 0
    // absolute cursor position (0-100%) for the ambient light that
    // actually tracks the cursor — separate from --mx/--my above, which
    // stay a small -1..1 offset used for the existing parallax multiplier
    let pendingPx = 50
    let pendingPy = 40
    let pointerActive = false
    function applyPointer() {
      pointerRaf = null
      el.style.setProperty('--mx', pendingMx.toFixed(3))
      el.style.setProperty('--my', pendingMy.toFixed(3))
      el.style.setProperty('--px', `${pendingPx.toFixed(2)}%`)
      el.style.setProperty('--py', `${pendingPy.toFixed(2)}%`)
      el.style.setProperty('--cursor-glow-opacity', pointerActive ? '1' : '0')
    }
    function handlePointerMove(e) {
      const rect = el.getBoundingClientRect()
      const fx = (e.clientX - rect.left) / rect.width
      const fy = (e.clientY - rect.top) / rect.height
      pendingMx = (fx - 0.5) * 2
      pendingMy = (fy - 0.5) * 2
      pendingPx = fx * 100
      pendingPy = fy * 100
      pointerActive = true
      if (pointerRaf === null) pointerRaf = requestAnimationFrame(applyPointer)
    }
    function handlePointerLeave() {
      pendingMx = 0
      pendingMy = 0
      pointerActive = false
      if (pointerRaf === null) pointerRaf = requestAnimationFrame(applyPointer)
    }
    // fine pointers only — on touch devices parallax stays off entirely
    // rather than reacting to scroll-driven touch coordinates
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    if (!isCoarsePointer) {
      el.addEventListener('pointermove', handlePointerMove)
      el.addEventListener('pointerleave', handlePointerLeave)
    }

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollRaf !== null) cancelAnimationFrame(scrollRaf)
      if (!isCoarsePointer) {
        el.removeEventListener('pointermove', handlePointerMove)
        el.removeEventListener('pointerleave', handlePointerLeave)
      }
      if (pointerRaf !== null) cancelAnimationFrame(pointerRaf)
    }
  }, [])

  // A subtle "magnetic" pull on the primary CTA — the button nudges a few
  // px toward the cursor within its own bounds, spring-eased back to rest
  // on leave. Writes straight to the element's style (no React state) so
  // it costs nothing beyond the pointer's own event rate, same pattern as
  // the hero-wide parallax listener above.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia('(pointer: coarse)').matches) return
    const el = ctaRef.current
    if (!el) return
    const MAX_PULL = 9
    function handleMove(e) {
      const rect = el.getBoundingClientRect()
      const fx = (e.clientX - rect.left) / rect.width - 0.5
      const fy = (e.clientY - rect.top) / rect.height - 0.5
      el.style.transform = `translate(${(fx * MAX_PULL * 2).toFixed(1)}px, ${(fy * MAX_PULL * 2).toFixed(1)}px)`
    }
    function handleLeave() {
      el.style.transform = ''
    }
    el.addEventListener('pointermove', handleMove)
    el.addEventListener('pointerleave', handleLeave)
    return () => {
      el.removeEventListener('pointermove', handleMove)
      el.removeEventListener('pointerleave', handleLeave)
    }
  }, [])

  // A very small cursor-proximity nudge on the Voice Wave Core — the core
  // and its particles drift up to ~4px toward the pointer within the
  // core's own bounds, spring back on leave. Same ref-driven,
  // no-React-state pattern as the CTA's magnetic pull above, just a
  // smaller pull radius and its own custom properties so it never fights
  // that effect or the hero-wide parallax.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia('(pointer: coarse)').matches) return
    const el = waveRef.current
    if (!el) return
    const MAX_PULL = 4
    function handleMove(e) {
      const rect = el.getBoundingClientRect()
      const fx = (e.clientX - rect.left) / rect.width - 0.5
      const fy = (e.clientY - rect.top) / rect.height - 0.5
      el.style.setProperty('--wx', `${(fx * MAX_PULL * 2).toFixed(1)}px`)
      el.style.setProperty('--wy', `${(fy * MAX_PULL * 2).toFixed(1)}px`)
    }
    function handleLeave() {
      el.style.setProperty('--wx', '0px')
      el.style.setProperty('--wy', '0px')
    }
    el.addEventListener('pointermove', handleMove)
    el.addEventListener('pointerleave', handleLeave)
    return () => {
      el.removeEventListener('pointermove', handleMove)
      el.removeEventListener('pointerleave', handleLeave)
    }
  }, [])

  // A light magnetic pull on whichever feature card the pointer is over —
  // delegated to the strip's own pointermove rather than four separate
  // listeners, and skipped for coarse (touch) pointers where "hover" has
  // no meaning. Writes straight to the card's style (no React state).
  function handleFeaturesPointerMove(e) {
    if (e.pointerType !== 'mouse') return
    const item = e.target.closest('.hero__rail-item')
    e.currentTarget.querySelectorAll('.hero__rail-item').forEach((el) => {
      el.classList.toggle('is-hot', el === item)
    })
  }

  function handleFeaturesPointerLeave(e) {
    e.currentTarget.querySelectorAll('.hero__rail-item').forEach((item) => {
      item.classList.remove('is-hot')
    })
  }

  function handleStart() {
    setRippleId((id) => id + 1)
    setVoiceState('listening')
    playSound('activate')
    window.setTimeout(onStart, 420)
  }

  return (
    <section id="home" className="hero" data-voice-state={voiceState} ref={heroRef}>
      <BeachScene />

      {/* the premium gold light effect replacing the old orb — a single
          soft diagonal sweep behind the headline, not another circular
          graphic. Purely decorative (aria-hidden), driven entirely by
          CSS; no state, no particles "attached" to it the way the old
          orb had. BeachScene's ripple/pulse effects still key off
          --core-x/--core-y underneath this for the listening/processing/
          answered moments, same as before — just nothing permanently
          visible sits there any more. */}
      <span className="hero__gold-sweep" aria-hidden="true" />

      <div className="hero__stack">
        <div className="hero__content">
          <span className="hero__eyebrow hero__reveal" style={{ '--d': '0s' }}>
            <span className="hero__eyebrow-dot" aria-hidden="true" />
            {t('hero.badge')}
          </span>

          {/* key={languageCode} replays the same fade-in used on load
              whenever the visitor manually picks a different language from
              the navbar dropdown — never on a timer, never automatically.
              Each line now carries its own reveal timing (not one shared
              delay on the parent) so "ASK GOA." settles in first and "IN
              YOUR LANGUAGE." follows ~100ms later, rather than both lines
              arriving together. */}
          <h1 className="hero__headline" lang={languageCode}>
            <span className="hero__headline-morph" key={languageCode}>
              <span className="hero__headline-row hero__reveal" style={{ '--d': '0.1s' }}>
                {t('hero.titleLine1')}
              </span>
              <span className="hero__headline-row hero__headline-row--accent hero__reveal" style={{ '--d': '0.2s' }}>
                {t('hero.titleLine2')}
              </span>
            </span>
          </h1>

          <p className="hero__sub hero__reveal" style={{ '--d': '0.32s' }}>
            {t('hero.subLine1')}
          </p>

          <div className="hero__cta hero__reveal" style={{ '--d': '0.44s' }}>
            <button type="button" className="btn btn--primary hero__cta-primary" ref={ctaRef} onClick={handleStart}>
              <MicIcon width={18} height={18} />
              {t('hero.startAsking')}
              <span className="hero__cta-arrow" aria-hidden="true">→</span>
              {rippleId > 0 && <span key={rippleId} className="btn-click-ripple" aria-hidden="true" />}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onHowItWorks}>
              {t('hero.howItWorksBtn')}
            </button>
          </div>
        </div>

        {/* the Voice Wave Core — a small, secondary visual sitting below
            the copy, not a giant microphone icon and not a fake product
            screenshot. A compact organic core (not a diamond, not a
            circle outline) with a soft atmospheric glow, a handful of
            drifting particles, and a small waveform beneath it, all
            reacting quietly to the same data-voice-state BeachScene's
            ripples already key off. */}
        <div className="hero__wave-wrap hero__reveal" style={{ '--d': '0.58s' }} aria-hidden="true" ref={waveRef}>
          {/* a very soft radial light sitting behind the whole
              visualization — separate from (and much larger/softer
              than) the tight halo directly behind the core itself, just
              enough to keep this part of the hero from reading as flat */}
          <span className="hero__wave-depth" />

          {/* a dozen tiny ambient particles scattered across the lower-mid
              hero — independent of the core's own particle scatter and
              the trail below, purely atmospheric */}
          <div className="hero__wave-ambient">
            {AMBIENT_PARTICLES.map((p, i) => (
              <span
                key={i}
                className={`hero__wave-ambient-particle hero__wave-ambient-particle--${p.tone}${p.sway ? ' hero__wave-ambient-particle--sway' : ''}`}
                style={{ top: `${p.top}%`, left: `${p.left}%`, width: `${p.size}px`, height: `${p.size}px`, '--i': i }}
              />
            ))}
          </div>

          <div className="hero__wave-group">
            <span className="hero__wave-glow" />
            <span className="hero__wave-core">
              <span className="hero__wave-core-highlight" />
              <MicIcon width={12} height={12} />
              <span className="hero__wave-core-shadow" />
            </span>
            {WAVE_PARTICLES.map((p, i) => (
              <span
                key={i}
                className="hero__wave-particle"
                style={{ top: `${p.top}%`, left: `${p.left}%`, width: `${p.size}px`, height: `${p.size}px`, '--i': i }}
              />
            ))}
          </div>

          <div className="hero__wave-bars">
            {WAVE_BARS.map((h, i) => (
              <span key={i} className="hero__wave-bar" style={{ '--h': `${h}%`, '--i': i }} />
            ))}
          </div>

          <span className="hero__wave-status">
            <span className="hero__wave-dot" />
            {t(WAVE_LABEL_KEYS[voiceState] || WAVE_LABEL_KEYS.idle)}
          </span>

          {/* the "audio intelligence trail" — small fragments drifting
              outward from centre and fading, reads as a signal quietly
              dispersing rather than a decorative equalizer */}
          <div className="hero__wave-trail">
            {TRAIL_FRAGMENTS.map((f, i) => (
              <span
                key={i}
                className={`hero__wave-trail-fragment hero__wave-trail-fragment--${f.tone}`}
                style={{
                  width: `${f.size}px`,
                  height: `${f.size}px`,
                  '--side': f.side,
                  '--dist': f.dist,
                  '--i': i,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* a single clean horizontal rail, not four separate cards — icon +
          label pairs divided by thin hairlines, the item under the
          pointer gets a small gold glow rather than the whole strip
          lifting as one block */}
      <div
        className="hero__rail hero__reveal"
        style={{ '--d': '0.72s' }}
        onPointerMove={handleFeaturesPointerMove}
        onPointerLeave={handleFeaturesPointerLeave}
      >
        {FEATURES.map(({ id, Icon, titleKey, bodyKey }) => (
          <div className="hero__rail-item" data-feature={id} key={id}>
            <span className="hero__rail-icon" aria-hidden="true">
              <Icon width={16} height={16} />
            </span>
            <span className="hero__rail-copy">
              <span className="hero__rail-label">{t(titleKey)}</span>
              <span className="hero__rail-body">{t(bodyKey)}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

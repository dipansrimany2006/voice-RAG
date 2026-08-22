import { useEffect, useRef, useState } from 'react'
import BeachScene from './BeachScene'
import BackgroundGridDots from './BackgroundGridDots'
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
      {/* .hero paints its own opaque background (see index.css), which
          would otherwise fully hide the site-wide fixed grid mounted in
          App.jsx for this entire first viewport — same reason BeachScene
          lives here rather than relying on the outer BackgroundDecor.
          `.hero`'s `isolation: isolate` gives this its own local stacking
          context, so a second instance here paints above the hero's own
          background fill but still behind `.hero__stack`'s real content. */}
      <BackgroundGridDots/>
      {/* <BeachScene /> */}

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

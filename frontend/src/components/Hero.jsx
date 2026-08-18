import { useEffect, useRef, useState } from 'react'
import BeachScene from './BeachScene'
import { MicIcon, SparkleIcon, ShieldIcon, WaveformIcon, BoltIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'
import { useSound } from '../SoundContext'

// The 4-item highlight strip along the bottom of the hero — copy already
// existed in translations.js (`home.feature*`, full 14-language parity)
// from an earlier pass but was never actually rendered anywhere; this is
// the first real use of it, not new copy.
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
  const heroRef = useRef(null)

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

  function handleStart() {
    setVoiceState('listening')
    playSound('activate')
    window.setTimeout(onStart, 420)
  }

  return (
    <section id="home" className="hero" data-voice-state={voiceState} ref={heroRef}>
      <BeachScene />
      <div className="hero__stack">
        <div className="hero__content">
          <span className="hero__eyebrow hero__reveal" style={{ '--d': '0s' }}>
            {t('hero.badge')}
          </span>

          {/* key={languageCode} replays the same fade-in used on load
              whenever the visitor manually picks a different language from
              the navbar dropdown — never on a timer, never automatically */}
          <h1 className="hero__headline hero__reveal" style={{ '--d': '0.08s' }} lang={languageCode}>
            <span className="hero__headline-morph" key={languageCode}>
              <span className="hero__headline-row">{t('hero.titleLine1')}</span>
              <span className="hero__headline-row hero__headline-row--accent">{t('hero.titleLine2')}</span>
            </span>
          </h1>

          <p className="hero__sub hero__reveal" style={{ '--d': '0.16s' }}>
            {t('hero.subLine1')}
          </p>

          <div className="hero__cta hero__reveal" style={{ '--d': '0.24s' }}>
            <button type="button" className="btn btn--primary hero__cta-primary" onClick={handleStart}>
              <MicIcon width={18} height={18} />
              {t('hero.startAsking')}
              <span className="hero__cta-arrow" aria-hidden="true">→</span>
            </button>
            <button type="button" className="btn btn--ghost" onClick={onHowItWorks}>
              {t('hero.howItWorksBtn')}
            </button>
          </div>
        </div>
      </div>

      {/* sits outside .hero__stack (which caps at 640px for the centred
          headline column) so the 4-item panel can use the hero's full
          width instead of being squeezed into the text column's */}
      <div className="hero__features hero__reveal" style={{ '--d': '0.32s' }}>
        {FEATURES.map(({ id, Icon, titleKey, bodyKey }) => (
          <div className="hero__feature" key={id}>
            <span className="hero__feature-icon" aria-hidden="true">
              <Icon width={18} height={18} />
            </span>
            <div className="hero__feature-copy">
              <p className="hero__feature-title">{t(titleKey)}</p>
              <p className="hero__feature-body">{t(bodyKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

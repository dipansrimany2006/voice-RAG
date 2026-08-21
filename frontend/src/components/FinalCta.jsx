import { useMemo, useState } from 'react'
import { MicIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

const PARTICLE_COUNT = 7

function makeParticles(seed) {
  const rand = seeded(seed)
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: (20 + rand() * 60).toFixed(1),
    top: (20 + rand() * 60).toFixed(1),
    size: (2 + rand() * 2.4).toFixed(1),
    duration: (10 + rand() * 8).toFixed(1),
    delay: (-(rand() * 16)).toFixed(1),
  }))
}

const PARTICLES = makeParticles(31)

// Compact closing nudge — deliberately small, not a second hero.
export default function FinalCta({ onStart }) {
  const { t } = useLanguage()
  const [rippleId, setRippleId] = useState(0)
  const particles = useMemo(() => PARTICLES, [])

  function handleClick() {
    setRippleId((id) => id + 1)
    onStart()
  }

  return (
    <section className="final-cta">
      <div className="final-cta__particles" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="final-cta__particle"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              '--dur': `${p.duration}s`,
              '--delay': `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="shell final-cta__inner">
        <h2 className="final-cta__title">{t('home.finalCtaTitle')}</h2>
        <p className="final-cta__body">{t('home.finalCtaBody')}</p>
        <button type="button" className="btn btn--primary hero__cta-primary final-cta__btn" onClick={handleClick}>
          <MicIcon width={16} height={16} />
          {t('hero.startAsking')}
          <span className="hero__cta-arrow" aria-hidden="true">→</span>
          {rippleId > 0 && <span key={rippleId} className="btn-click-ripple" aria-hidden="true" />}
        </button>
        <p className="final-cta__footnote">{t('hero.trustLine')}</p>
      </div>

      <svg className="final-cta__wave" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,32 C260,58 420,4 700,26 C920,44 1060,10 1200,28 L1200,60 L0,60 Z" />
      </svg>
    </section>
  )
}

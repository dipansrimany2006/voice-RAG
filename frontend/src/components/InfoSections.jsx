import { useEffect, useRef, useState } from 'react'
import { EditorialAtmosphere } from './SectionAtmosphere'
import { MicIcon, WaveformIcon, SearchIcon, ChipIcon, CheckIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'

const JOURNEY_STEPS = [
  { key: 'speak', titleKey: 'howItWorks.step1Title', bodyKey: 'howItWorks.step1Body', Icon: MicIcon },
  { key: 'understand', titleKey: 'howItWorks.step2Title', bodyKey: 'howItWorks.step2Body', Icon: WaveformIcon },
  { key: 'retrieve', titleKey: 'howItWorks.step3Title', bodyKey: 'howItWorks.step3Body', Icon: SearchIcon },
  { key: 'generate', titleKey: 'howItWorks.step4Title', bodyKey: 'howItWorks.step4Body', Icon: ChipIcon },
  { key: 'answer', titleKey: 'howItWorks.step5Title', bodyKey: 'howItWorks.step5Body', Icon: CheckIcon },
]

export function HowItWorks() {
  const { t } = useLanguage()
  const stepRefs = useRef([])
  const [visible, setVisible] = useState(() => new Set())

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(new Set(JOURNEY_STEPS.map((_, i) => i)))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const idx = Number(entry.target.dataset.journeyIndex)
          setVisible((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)))
        })
      },
      { threshold: 0.15 },
    )
    stepRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section id="how-it-works" className="info-section info-section--journey">
      <EditorialAtmosphere />
      <div className="info-section__inner">
        <span className="eyebrow">{t('howItWorks.eyebrow')}</span>
        <h2 className="info-section__title">{t('howItWorks.title')}</h2>

        <div className="journey">
          <svg className="journey__line" viewBox="0 0 1200 140" preserveAspectRatio="none" aria-hidden="true">
            <path
              className="journey__line-path"
              d="M10,70 C160,20 260,120 400,70 S600,20 700,70 S900,120 1000,70 S1140,20 1190,70"
            />
          </svg>
          <ol className="journey__steps">
            {JOURNEY_STEPS.map((step, i) => (
              <li
                key={step.key}
                ref={(el) => (stepRefs.current[i] = el)}
                data-journey-index={i}
                className={`journey__step${visible.has(i) ? ' is-visible' : ''}`}
                style={{ '--i': i }}
              >
                <span className="journey__number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span className="journey__node">
                  <step.Icon width={20} height={20} />
                </span>
                <h3 className="journey__label">{t(step.titleKey)}</h3>
                <p className="journey__body">{t(step.bodyKey)}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

export function About() {
  const { t } = useLanguage()

  return (
    <section id="about" className="info-section info-section--about">
      <EditorialAtmosphere />
      <div className="info-section__inner info-section__inner--split">
        <div className="about-copy">
          <span className="eyebrow">{t('about.eyebrow')}</span>
          <h2 className="info-section__title info-section__title--display">{t('about.title')}</h2>
          <p className="info-section__body">{t('about.body')}</p>
        </div>
        <ul className="about-stats">
          <li>
            <strong>14</strong>
            <span>{t('about.factLanguagesLabel')}</span>
          </li>
          <li>
            <strong>3</strong>
            <span>{t('about.factStrategiesLabel')}</span>
          </li>
          <li>
            <strong>
              &lt;200<em>ms</em>
            </strong>
            <span>{t('about.factLatencyLabel')}</span>
          </li>
        </ul>
      </div>
    </section>
  )
}

export function Docs() {
  const { t } = useLanguage()

  return (
    <section id="docs" className="info-section info-section--docs">
      <div className="info-section__inner">
        <span className="eyebrow eyebrow--gold">{t('docs.eyebrow')}</span>
        <h2 className="info-section__title info-section__title--on-dark">{t('docs.title')}</h2>
        <div className="docs-grid">
          <div className="docs-card">
            <h3>{t('docs.apiTitle')}</h3>
            <p>
              <code>
                <span className="docs-method docs-method--get">GET</span> /api/strategies
              </code>
            </p>
            <p>
              <code>
                <span className="docs-method docs-method--post">POST</span> /api/query/text
              </code>
            </p>
            <p>
              <code>
                <span className="docs-method docs-method--post">POST</span> /api/query/audio
              </code>
            </p>
          </div>
          <div className="docs-card">
            <h3>{t('docs.guardrailsTitle')}</h3>
            <p>{t('docs.guardrailsBody')}</p>
          </div>
          <div className="docs-card">
            <h3>{t('docs.setupTitle')}</h3>
            <p>
              {t('docs.setupBodyPrefix')} <code>scripts/build_index.py</code>
              {t('docs.setupBodySuffix')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

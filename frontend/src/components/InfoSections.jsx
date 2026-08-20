import { EditorialAtmosphere } from './SectionAtmosphere'
import StepsList from './StepsList'
import { useLanguage } from '../i18n/LanguageContext'

const JOURNEY_STEPS = [
  { key: 'speak', titleKey: 'howItWorks.step1Title', bodyKey: 'howItWorks.step1Body' },
  { key: 'understand', titleKey: 'howItWorks.step2Title', bodyKey: 'howItWorks.step2Body' },
  { key: 'retrieve', titleKey: 'howItWorks.step3Title', bodyKey: 'howItWorks.step3Body' },
  { key: 'generate', titleKey: 'howItWorks.step4Title', bodyKey: 'howItWorks.step4Body' },
  { key: 'answer', titleKey: 'howItWorks.step5Title', bodyKey: 'howItWorks.step5Body' },
]

export function HowItWorks() {
  const { t } = useLanguage()

  return (
    <section id="how-it-works" className="info-section info-section--journey">
      <EditorialAtmosphere />
      <div className="info-section__inner">
        <span className="eyebrow">{t('howItWorks.eyebrow')}</span>
        <h2 className="info-section__title">{t('howItWorks.title')}</h2>

        <StepsList steps={JOURNEY_STEPS} />
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

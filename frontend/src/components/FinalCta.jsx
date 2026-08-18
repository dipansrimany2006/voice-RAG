import { MicIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'

// Compact closing nudge — deliberately small, not a second hero.
export default function FinalCta({ onStart }) {
  const { t } = useLanguage()

  return (
    <section className="final-cta">
      <div className="shell final-cta__inner">
        <h2 className="final-cta__title">{t('home.finalCtaTitle')}</h2>
        <p className="final-cta__body">{t('home.finalCtaBody')}</p>
        <button type="button" className="btn btn--primary final-cta__btn" onClick={onStart}>
          <MicIcon width={16} height={16} />
          {t('hero.startAsking')}
          <span className="hero__cta-arrow" aria-hidden="true">→</span>
        </button>
        <p className="final-cta__footnote">{t('hero.trustLine')}</p>
      </div>

      <svg className="final-cta__wave" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,32 C260,58 420,4 700,26 C920,44 1060,10 1200,28 L1200,60 L0,60 Z" />
      </svg>
    </section>
  )
}

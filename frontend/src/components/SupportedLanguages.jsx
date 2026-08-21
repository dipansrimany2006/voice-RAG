import { LANGUAGES } from '../languages'
import { useLanguage } from '../i18n/LanguageContext'

// The real, complete list of 14 supported languages — no truncation, since
// the actual count is short enough to show in full rather than implying
// there's more hidden behind a "+N" chip.
export default function SupportedLanguages() {
  const { t } = useLanguage()

  return (
    <section id="languages" className="info-section info-section--languages">
      <div className="info-section__inner">
        <span className="eyebrow">{t('languages.eyebrow')}</span>
        <div className="lang-chips">
          {LANGUAGES.map((lang) => (
            <span className="lang-chip" key={lang.code}>
              {lang.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

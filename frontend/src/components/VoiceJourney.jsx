import StepsList from './StepsList'
import { useLanguage } from '../i18n/LanguageContext'

const STAGES = [
  { key: 'voice', titleKey: 'howItWorks.step1Title' },
  { key: 'understand', titleKey: 'howItWorks.step2Title' },
  { key: 'retrieve', titleKey: 'howItWorks.step3Title' },
  { key: 'generate', titleKey: 'howItWorks.step4Title' },
  { key: 'answer', titleKey: 'howItWorks.step5Title' },
]

// The compact preview of "how it works" on the marketing page — same
// five numbered stages as the detailed /app section (via the shared
// StepsList), titles only, no body copy. The full prose version lives
// on the /app page's How It Works section.
export default function VoiceJourney() {
  const { t } = useLanguage()

  return (
    <section className="voice-journey">
      <div className="shell">
        <span className="eyebrow">{t('home.journeyEyebrow')}</span>
        <h2 className="voice-journey__title">{t('howItWorks.title')}</h2>
        <p className="voice-journey__subtitle">{t('howItWorks.subtitle')}</p>

        <StepsList steps={STAGES} compact />
      </div>
    </section>
  )
}

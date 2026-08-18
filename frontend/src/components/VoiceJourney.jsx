import { useEffect, useRef, useState } from 'react'
import { MicIcon, WaveformIcon, SearchIcon, ChipIcon, CheckIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'

const STAGES = [
  { key: 'voice', Icon: MicIcon, labelKey: 'pipeline.stageVoice' },
  { key: 'understand', Icon: WaveformIcon, labelKey: 'howItWorks.step2Title' },
  { key: 'retrieve', Icon: SearchIcon, labelKey: 'howItWorks.step3Title' },
  { key: 'generate', Icon: ChipIcon, labelKey: 'howItWorks.step4Title' },
  { key: 'answer', Icon: CheckIcon, labelKey: 'howItWorks.step5Title' },
]

// The visual heart of "how it works" on the marketing page — a compact,
// animated pipeline instead of paragraphs. Each stage carries a tiny
// hand-built motif (equalizer bars / document stack / processing core /
// checkmark) so the icon set alone communicates "voice in, grounded
// answer out" without any explanatory copy. The detailed prose version
// lives on the /app page's How It Works section.
export default function VoiceJourney() {
  const { t } = useLanguage()
  const sectionRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className={`voice-journey${visible ? ' is-visible' : ''}`} ref={sectionRef}>
      <div className="shell">
        <span className="eyebrow">{t('home.journeyEyebrow')}</span>
        <h2 className="voice-journey__title">{t('howItWorks.title')}</h2>
        <p className="voice-journey__subtitle">{t('howItWorks.subtitle')}</p>

        <div className="voice-journey__track">
          {/* baseline touchpoints (120/360/600/840/1080 of a 1200-wide
              viewBox = 10/30/50/70/90%) are hand-matched to where each
              node actually centers in the zero-gap 5-column grid below,
              so the wave visibly threads through every node instead of
              floating past it */}
          <svg className="voice-journey__line" viewBox="0 0 1200 84" preserveAspectRatio="none" aria-hidden="true">
            <path
              className="voice-journey__line-path"
              pathLength="100"
              d="M120,42 C190,14 290,70 360,42 S500,14 600,42 S740,70 840,42 S980,14 1080,42"
            />
          </svg>
          <span className="voice-journey__traveler" aria-hidden="true" />
          <ol className="voice-journey__stages">
            {STAGES.map((stage, i) => (
              <li key={stage.key} className="voice-journey__stage" data-step={stage.key} style={{ '--i': i }}>
                <span className="voice-journey__node">
                  <stage.Icon width={26} height={26} />
                  <span className="voice-journey__motif" aria-hidden="true">
                    <span className="voice-journey__motif-bar" />
                    <span className="voice-journey__motif-bar" />
                    <span className="voice-journey__motif-bar" />
                  </span>
                </span>
                <span className="voice-journey__label">{t(stage.labelKey)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

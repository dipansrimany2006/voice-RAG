import { useLanguage } from '../i18n/LanguageContext'

const STAGES = [
  { key: 'input', labelKey: 'pipeline.stageInput' },
  { key: 'understand', labelKey: 'howItWorks.step2Title' },
  { key: 'retrieve', labelKey: 'howItWorks.step3Title' },
  { key: 'generate', labelKey: 'howItWorks.step4Title' },
  { key: 'answer', labelKey: 'howItWorks.step5Title' },
]

// A compact, honest echo of the marketing "how it works" pipeline,
// but wired to the real query lifecycle. The API is a single
// request/response, not a streaming endpoint with per-stage events, so
// this deliberately never claims to know which sub-stage is "current" —
// every stage lights up together while a request is in flight, then
// settles to complete on a real success. That's the truthful amount of
// detail the backend actually gives us.
export default function ProcessingPipeline({ status }) {
  const { t } = useLanguage()
  const stageState = status === 'loading' ? 'active' : status === 'success' ? 'complete' : 'pending'

  return (
    <div className={`pipeline-strip pipeline-strip--${stageState}`} aria-hidden="true">
      {STAGES.map((s, i) => (
        <div key={s.key} className="pipeline-strip__stage" style={{ '--i': i }}>
          <span className="pipeline-strip__dot" />
          <span className="pipeline-strip__label">{t(s.labelKey)}</span>
        </div>
      ))}
    </div>
  )
}

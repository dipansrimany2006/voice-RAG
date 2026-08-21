import { useEffect, useRef, useState } from 'react'
import { MicIcon, WaveformIcon, SearchIcon, ChipIcon, CheckIcon } from './Icons'
import { useLanguage } from '../i18n/LanguageContext'

// Both callers (the compact Home preview and the fuller /app section)
// render the same five stages in the same order, so the icon set lives
// here once rather than being threaded through as a prop from each.
const STEP_ICONS = [MicIcon, WaveformIcon, SearchIcon, ChipIcon, CheckIcon]

// The shared "numbered process" visual — used by both the compact
// pipeline preview on the Home hero and the fuller How It Works section
// on /app. Replaces the old circular-node-plus-travelling-dot graphic
// entirely: a vertical timeline on mobile, a clean horizontal
// progression on desktop, with the connecting rule and each step's
// number lighting up in gold as the visitor scrolls past it. A single
// gold marker slides along the rule to the active step, and a couple of
// tiny particles drift continuously along the full line — a quiet
// "signal flowing through the pipeline" cue, independent of scroll.
export default function StepsList({ steps, compact = false }) {
  const { t } = useLanguage()
  const itemRefs = useRef([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length === 0) return
        // the step whose top is closest to (but still above) the
        // observer's centred band is the one currently "current" —
        // matches how a reader's eye tracks down the list on scroll
        const topMost = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        const idx = Number(topMost.target.dataset.stepIndex)
        setActiveIndex(idx)
      },
      { rootMargin: '-40% 0px -45% 0px', threshold: [0, 0.5, 1] },
    )
    itemRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="steps-track">
      <span
        className="steps-progress"
        aria-hidden="true"
        style={{ '--active': activeIndex, '--total': steps.length }}
      />
      <span className="steps-flow steps-flow--1" aria-hidden="true" />
      <span className="steps-flow steps-flow--2" aria-hidden="true" />

      <ol className={`steps${compact ? ' steps--compact' : ''}`}>
        {steps.map((step, i) => {
          const Icon = STEP_ICONS[i]
          return (
            <li
              key={step.key}
              ref={(el) => (itemRefs.current[i] = el)}
              data-step-index={i}
              className={`steps__item${i === activeIndex ? ' is-active' : i < activeIndex ? ' is-passed' : ''}`}
            >
              <span className="steps__rule" aria-hidden="true" />
              <span className="steps__number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="steps__title">
                <span className="steps__icon" aria-hidden="true">
                  <Icon width={13} height={13} />
                </span>
                {t(step.titleKey)}
              </h3>
              {!compact && <p className="steps__body">{t(step.bodyKey)}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

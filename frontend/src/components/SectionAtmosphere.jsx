import { useMemo } from 'react'

// Per-section decorative backgrounds. Each section gets its own atmosphere
// instead of the same dotted-grid-and-glow pattern repeating down the page:
// Ask = sage/warm-white glow + soft particles, Answer = calm white with
// flowing data lines, How-it-works = a quiet signal curve + particles,
// Footer = dark-green particles + a soft wave transition. All pure
// CSS/SVG, no canvas, motion respects prefers-reduced-motion (see
// index.css). No leaf/foliage motifs anywhere — this is a voice AI
// product, not a nature/travel site.

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function useParticles(count, seed, { toneCycle = ['green', 'gold'], top = [6, 94], leftBand = null } = {}) {
  return useMemo(() => {
    const rand = seeded(seed)
    return Array.from({ length: count }, (_, i) => {
      const left = leftBand
        ? leftBand[0] + rand() * (leftBand[1] - leftBand[0])
        : rand() * 100
      return {
        id: i,
        tone: toneCycle[i % toneCycle.length],
        left: left.toFixed(1),
        top: (top[0] + rand() * (top[1] - top[0])).toFixed(1),
        size: (rand() * 3 + 2.2).toFixed(1),
        duration: (rand() * 8 + 10).toFixed(1),
        delay: (rand() * -16).toFixed(1),
        dx: Math.round(rand() * 30 - 15),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed])
}

function Particle({ p, className }) {
  return (
    <span
      className={`${className} ${className}--${p.tone}`}
      style={{
        left: `${p.left}%`,
        top: `${p.top}%`,
        width: `${p.size}px`,
        height: `${p.size}px`,
        '--dur': `${p.duration}s`,
        '--delay': `${p.delay}s`,
        '--dx': `${p.dx}px`,
      }}
    />
  )
}

// ---------- Ask Anything: voice / audio-field atmosphere ----------
export function AskAtmosphere() {
  const particles = useParticles(12, 11, { top: [10, 90] })
  return (
    <div className="ask-atmo" aria-hidden="true">
      <span className="ask-atmo__glow" />
      {particles.map((p) => (
        <Particle key={p.id} p={p} className="ask-atmo__particle" />
      ))}
    </div>
  )
}

// ---------- Answer / Pipeline: calm intelligence atmosphere ----------
export function AnswerAtmosphere() {
  return (
    <div className="answer-atmo" aria-hidden="true">
      <span className="answer-atmo__glow answer-atmo__glow--green" />
      <span className="answer-atmo__glow answer-atmo__glow--gold" />
      <svg className="answer-atmo__lines" viewBox="0 0 1200 320" preserveAspectRatio="none">
        <path className="answer-atmo__line" d="M-40,60 C220,20 420,140 700,90 S1100,40 1260,110" />
        <path className="answer-atmo__line answer-atmo__line--b" d="M-40,230 C260,270 460,170 760,220 S1140,260 1260,190" />
      </svg>
    </div>
  )
}

// ---------- How it works: editorial / botanical atmosphere ----------
export function EditorialAtmosphere() {
  const particles = useParticles(7, 23, { top: [8, 85] })
  return (
    <div className="editorial-atmo" aria-hidden="true">
      <svg className="editorial-atmo__curve" viewBox="0 0 1200 300" preserveAspectRatio="none">
        <path d="M-40,40 C300,-10 500,120 900,70 S1200,140 1260,60" />
      </svg>
      {particles.map((p) => (
        <Particle key={p.id} p={p} className="editorial-atmo__particle" />
      ))}
    </div>
  )
}

// ---------- Footer: deep green calm ending ----------
export function FooterAtmosphere() {
  const particles = useParticles(8, 37, { toneCycle: ['gold', 'green'], top: [6, 85] })
  return (
    <div className="footer-atmo" aria-hidden="true">
      <svg className="footer-atmo__waves" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path
          d="M0 30c50 15 100 15 150 0s100-15 150 0 100 15 150 0 100-15 150 0 100 15 150 0 100-15 150 0 100 15 150 0 100-15 150 0v30H0Z"
          fill="var(--footer-bg-2)"
        />
      </svg>
      {particles.map((p) => (
        <Particle key={p.id} p={p} className="footer-atmo__particle" />
      ))}
    </div>
  )
}

// ---------- reusable curved transition between two sections ----------
export function WaveDivider({ fill = 'var(--bg-soft)', className = '' }) {
  return (
    <div className={`wave-divider ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1440 110" preserveAspectRatio="none">
        <path
          d="M0,50 C220,110 380,10 620,45 C860,80 1040,10 1260,40 C1340,50 1400,55 1440,50 L1440,110 L0,110 Z"
          style={{ fill }}
        />
      </svg>
    </div>
  )
}

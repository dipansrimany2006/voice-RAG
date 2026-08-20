import { useMemo } from 'react'

// The Home hero's background — deliberately minimal now: a dark studio,
// not a galaxy. One soft warm bloom, a handful of tiny slow dust
// particles, a cursor-tracking light, and the real voice-state reactions
// (ripples/processing ring/answer pulse). No colour-mesh pools, no giant
// organic blobs, no starfield — those read as generic "AI template"
// decoration and are gone on purpose. Pure CSS/SVG, no canvas, no
// per-frame React state — every layer just reads the
// --mx/--my/--px/--py/--scrollp custom properties Hero.jsx writes onto
// the shared `.hero` section.
//
// Kept the `beach-scene`/`BeachScene` name internally (harmless, purely
// an implementation-detail class prefix nobody sees).
const DUST_COUNT = 14

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

// Tiny, slow, mostly warm-white/gold dust motes — the only "particle"
// system left. Spread thin across the whole scene, biased away from the
// dead centre so the headline column stays clean.
function makeDust() {
  const rand = seeded(41)
  const tones = ['ivory', 'gold']
  return Array.from({ length: DUST_COUNT }, (_, i) => {
    const depth = rand()
    return {
      id: i,
      tone: tones[i % tones.length],
      left: (rand() * 100).toFixed(1),
      top: (6 + rand() * 88).toFixed(1),
      size: (1.2 + depth * 1.8).toFixed(1),
      peakOpacity: (0.18 + depth * 0.28).toFixed(2),
      duration: (rand() * 6 + 9).toFixed(1),
      delay: (rand() * -14).toFixed(1),
    }
  })
}

export default function BeachScene() {
  const dust = useMemo(makeDust, [])

  return (
    <div className="beach-scene" aria-hidden="true">
      {/* --- dark studio, back to front --- */}

      {/* one soft warm bloom sitting behind the Voice Core — the entire
          "lighting" budget for this scene, deliberately singular rather
          than several overlapping colour pools */}
      <span className="beach-scene__bloom" style={{ left: 'var(--core-x)', top: 'var(--core-y)' }} />

      {/* a soft ambient light that tracks the real cursor position
          (--px/--py, written by Hero.jsx's own pointermove handler) —
          heavily blurred so it reads as diffuse light in the scene, not
          a literal cursor follower. Fades in/out on pointer enter/leave
          via --cursor-glow-opacity from the same handler. */}
      <span className="beach-scene__cursor-glow" />

      {/* a thin scatter of tiny dust motes, for depth */}
      <div className="beach-scene__layer beach-scene__dust" style={{ '--depth': 3 }}>
        {dust.map((p) => (
          <span
            key={p.id}
            className={`beach-scene__dust-mote beach-scene__dust-mote--${p.tone}`}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              '--peak-opacity': p.peakOpacity,
              '--dur': `${p.duration}s`,
              '--delay': `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* processing only: a curved data pulse orbiting the Voice Core,
          positioned at the same --core-x/--core-y the core itself sits at */}
      <div className="beach-scene__layer beach-scene__processing-ring" style={{ '--depth': 2 }} />

      {/* answered only: one signal ripple travelling outward from the
          Core through the scene, then gone */}
      <div className="beach-scene__layer beach-scene__answer-ripple" style={{ '--depth': 2 }} />

      {/* listening only: the signature interaction — rings travelling
          outward from the Core, as if the voice itself were disturbing
          the field around it */}
      <div className="beach-scene__voice-ripples" style={{ left: 'var(--core-x)', top: 'var(--core-y)' }}>
        <span className="beach-scene__voice-ripple" />
        <span className="beach-scene__voice-ripple beach-scene__voice-ripple--b" />
        <span className="beach-scene__voice-ripple beach-scene__voice-ripple--c" />
      </div>

      {/* a single wide radial pulse, once, the instant listening starts —
          distinct from the tighter voice-ripples above: this one washes
          across the whole hero rather than travelling from the Core */}
      <span className="beach-scene__hero-pulse" />

      {/* atmospheric haze — softens the join between the hero and the
          section below instead of a hard edge */}
      <span className="beach-scene__haze" />
    </div>
  )
}

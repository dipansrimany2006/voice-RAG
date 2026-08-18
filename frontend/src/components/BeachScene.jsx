import { useMemo } from 'react'

// The Home hero's background — a custom visual language, not a generic
// AI-SaaS dot-grid. Two large soft organic blobs (magenta/violet lower-
// left, blue/violet lower-right), a flowing colour-mesh field, a
// starfield, translucent glass bubbles drifting up from the edges, and a
// soft light that tracks the real cursor — all anchored away from the
// centre so the headline stays clean and dark. The signature
// interaction is the voice ripple (tight rings from the Core) plus a
// wider one-shot pulse across the whole hero, both firing only on the
// real `listening` state. Pure CSS/SVG, no canvas, no per-frame React
// state — every layer just reads the --mx/--my/--px/--py/--scrollp
// custom properties Hero.jsx writes onto the shared `.hero` section, and
// every animation only ever touches
// transform/opacity/filter/border-radius/scale.
//
// Kept the `beach-scene`/`BeachScene` name internally (harmless, purely
// an implementation-detail class prefix nobody sees) even though the
// visual identity itself moved from Goa ocean to deep-space neon blobs.
const PARTICLE_COUNT = 9
const STAR_COUNT = 40
const BUBBLE_COUNT = 16

// Four soft colour pools (violet/magenta/blue/cyan), each its own drifting
// blurred circle, screen-blended so overlapping pools brighten into each
// other instead of muddying — the closest a few CSS radial-gradients get
// to a real shader mesh-gradient without an actual WebGL canvas. Spread
// across the whole scene (not just the corners, unlike the two main
// blobs) so the flowing-colour feel reaches the full first viewport.
const MESH_POOLS = [
  { id: 'a', left: 22, top: 30, size: 46, tone: 'violet', dur: 42, delay: 0 },
  { id: 'b', left: 76, top: 22, size: 40, tone: 'magenta', dur: 50, delay: -14 },
  { id: 'c', left: 62, top: 68, size: 44, tone: 'blue', dur: 46, delay: -28 },
  { id: 'd', left: 34, top: 74, size: 36, tone: 'cyan', dur: 38, delay: -8 },
]

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

// A handful of brighter ambient particles — static positions, slow
// individual pulse, mostly clustered toward the right/edges so the
// center text column stays clear.
function makeParticles() {
  const rand = seeded(41)
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const depth = rand()
    const tone = i % 3 === 0 ? 'gold' : 'emerald'
    return {
      id: i,
      tone,
      left: (rand() * 100).toFixed(1),
      top: (6 + rand() * 88).toFixed(1),
      size: (1.6 + depth * 2.6).toFixed(1),
      peakOpacity: (0.35 + depth * 0.45).toFixed(2),
      duration: (rand() * 5 + 6).toFixed(1),
      delay: (rand() * -12).toFixed(1),
    }
  })
}

// A full starfield scattered across the whole scene — tiny, slow,
// irregular twinkle, out of sync with each other so it never reads as
// one synchronised blink.
function makeStars() {
  const rand = seeded(67)
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const depth = rand()
    return {
      id: i,
      left: (rand() * 100).toFixed(1),
      top: (rand() * 96).toFixed(1),
      size: (1 + depth * 1.6).toFixed(1),
      duration: (rand() * 4 + 3).toFixed(1),
      delay: (rand() * -8).toFixed(1),
    }
  })
}

// Glass bubbles, biased toward the left/right edges (and occasionally
// top/bottom) so they never drift across the headline — each one slowly
// rises, sways sideways, and fades in/out at the top and bottom of its
// own loop rather than popping in/out abruptly.
function makeBubbles() {
  const rand = seeded(97)
  const tones = ['violet', 'magenta', 'blue']
  return Array.from({ length: BUBBLE_COUNT }, (_, i) => {
    const zone = rand()
    let left
    if (zone < 0.4) left = rand() * 20
    else if (zone < 0.8) left = 80 + rand() * 20
    else left = 20 + rand() * 60
    const depth = rand()
    return {
      id: i,
      tone: tones[i % tones.length],
      left: left.toFixed(1),
      top: (rand() * 100).toFixed(1),
      size: (8 + depth * 22).toFixed(1),
      breathe: rand() > 0.55,
      opacity: (0.12 + depth * 0.22).toFixed(2),
      driftX: ((rand() - 0.5) * 44).toFixed(0),
      duration: (rand() * 14 + 18).toFixed(1),
      delay: (-(rand() * 28)).toFixed(1),
    }
  })
}

export default function BeachScene() {
  const particles = useMemo(makeParticles, [])
  const stars = useMemo(makeStars, [])
  const bubbles = useMemo(makeBubbles, [])

  return (
    <div className="beach-scene" aria-hidden="true">
      {/* --- deep-space cosmic scene, back to front --- */}

      {/* a soft ambient light that tracks the real cursor position
          (--px/--py, written by Hero.jsx's own pointermove handler) —
          heavily blurred so it reads as diffuse light in the scene, not
          a literal cursor follower. Fades in/out on pointer enter/leave
          via --cursor-glow-opacity from the same handler. */}
      <span className="beach-scene__cursor-glow" />

      {/* the flowing colour-mesh field — see MESH_POOLS above */}
      <div className="beach-scene__layer beach-scene__mesh" style={{ '--depth': 0.4 }}>
        {MESH_POOLS.map((p) => (
          <span
            key={p.id}
            className={`beach-scene__mesh-pool beach-scene__mesh-pool--${p.tone}`}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}vw`,
              height: `${p.size}vw`,
              '--dur': `${p.dur}s`,
              '--delay': `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* a full starfield behind everything else */}
      <div className="beach-scene__layer beach-scene__stars" style={{ '--depth': 0.6 }}>
        {stars.map((s) => (
          <span
            key={s.id}
            className="beach-scene__star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              '--dur': `${s.duration}s`,
              '--delay': `${s.delay}s`,
            }}
          />
        ))}
      </div>

      {/* the two soft organic blobs — the primary visual now. Anchored
          to the lower corners and mostly off-canvas so their mass never
          reaches the centre; a ring-shaped radial gradient (dark at the
          very middle, brightest at ~80% of the shape, fading again at
          the edge) is what gives each one a glowing rim instead of a
          flat glowing disc. */}
      <div className="beach-scene__layer beach-scene__blob-wrap beach-scene__blob-wrap--a" style={{ '--depth': 0.8 }}>
        <span className="beach-scene__blob beach-scene__blob--a" />
      </div>
      <div className="beach-scene__layer beach-scene__blob-wrap beach-scene__blob-wrap--b" style={{ '--depth': 0.8 }}>
        <span className="beach-scene__blob beach-scene__blob--b" />
      </div>

      {/* processing only: a curved data pulse orbiting the Voice Core,
          positioned at the same --core-x/--core-y the orb itself sits at */}
      <div className="beach-scene__layer beach-scene__processing-ring" style={{ '--depth': 2 }} />

      {/* answered only: one signal ripple travelling outward from the
          Core through the scene, then gone */}
      <div className="beach-scene__layer beach-scene__answer-ripple" style={{ '--depth': 2 }} />

      {/* listening only: the signature interaction — rings travelling
          outward and down from the Core, as if the voice itself were
          disturbing the field around it */}
      <div className="beach-scene__voice-ripples" style={{ left: 'var(--core-x)', top: 'var(--core-y)' }}>
        <span className="beach-scene__voice-ripple" />
        <span className="beach-scene__voice-ripple beach-scene__voice-ripple--b" />
        <span className="beach-scene__voice-ripple beach-scene__voice-ripple--c" />
      </div>

      {/* a few brighter floating ambient particles, for depth */}
      <div className="beach-scene__layer beach-scene__particles" style={{ '--depth': 4 }}>
        {particles.map((p) => (
          <span
            key={p.id}
            className={`beach-scene__particle beach-scene__particle--${p.tone}`}
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

      {/* translucent glass bubbles — biased to the edges (see
          makeBubbles), slowly rising and swaying, some also breathing.
          Brighter and slightly quicker while actually listening. */}
      <div className="beach-scene__bubbles">
        {bubbles.map((b) => (
          <span
            key={b.id}
            className={`beach-scene__bubble beach-scene__bubble--${b.tone}${b.breathe ? ' beach-scene__bubble--breathe' : ''}`}
            style={{
              left: `${b.left}%`,
              top: `${b.top}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              '--peak-opacity': b.opacity,
              '--drift-x': `${b.driftX}px`,
              '--dur': `${b.duration}s`,
              '--delay': `${b.delay}s`,
            }}
          />
        ))}
      </div>

      {/* a single wide radial pulse, once, the instant listening starts —
          distinct from the tighter voice-ripples below: this one washes
          across the whole hero rather than travelling from the Core */}
      <span className="beach-scene__hero-pulse" />

      {/* atmospheric haze — softens the join between the hero and the
          section below instead of a hard edge */}
      <span className="beach-scene__haze" />
    </div>
  )
}

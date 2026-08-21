function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

// A handful of tiny, very slow-drifting motes across the whole page —
// the sitewide "premium AI SaaS" ambient signature, distinct from (and
// far subtler than) the denser per-section atmospheres below it.
const PARTICLE_COUNT = 9

function makeParticles(seed) {
  const rand = seeded(seed)
  const tones = ['violet', 'blue', 'magenta']
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    tone: tones[i % tones.length],
    left: (rand() * 100).toFixed(1),
    top: (15 + rand() * 70).toFixed(1),
    size: (2 + rand() * 3).toFixed(1),
    dx: (rand() * 24 - 12).toFixed(1),
    duration: (16 + rand() * 14).toFixed(1),
    delay: (-(rand() * 22)).toFixed(1),
  }))
}

const PARTICLES = makeParticles(11)

// A sparse starfield with real depth — size and twinkle brightness both
// scale off the same per-star depth value, so closer stars read as bigger
// and brighter rather than every star being an identical dot.
const STAR_COUNT = 22

function makeStars(seed) {
  const rand = seeded(seed)
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const depth = rand()
    return {
      id: i,
      left: (rand() * 100).toFixed(1),
      top: (rand() * 100).toFixed(1),
      size: (1 + depth * 1.8).toFixed(1),
      peakOpacity: (0.3 + depth * 0.5).toFixed(2),
      duration: (3 + rand() * 5).toFixed(1),
      delay: (-(rand() * 9)).toFixed(1),
    }
  })
}

const STARS = makeStars(29)

// Fixed, pointer-events-none, sitewide backdrop: a faint grain texture,
// three large slow-drifting purple/blue/magenta radial glows, a sparse
// depth-varied starfield, and a scattering of tiny floating particles.
// Every denser atmospheric element (grids, botanicals, per-section glow
// fields) still lives closer to the content that needs it — see
// BeachScene, SectionAtmosphere, VoiceWave — so this stays the one quiet
// layer behind all of it rather than competing with them. Paused under
// prefers-reduced-motion via index.css.
export default function BackgroundDecor() {
  return (
    <div className="bg-decor" aria-hidden="true">
      <div className="bg-decor__grain" />
      <span className="bg-decor__glow bg-decor__glow--a" />
      <span className="bg-decor__glow bg-decor__glow--b" />
      <span className="bg-decor__glow bg-decor__glow--c" />
      <div className="bg-decor__stars">
        {STARS.map((s) => (
          <span
            key={s.id}
            className="bg-decor__star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              '--peak-opacity': s.peakOpacity,
              '--dur': `${s.duration}s`,
              '--delay': `${s.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="bg-decor__particles">
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className={`bg-decor__particle bg-decor__particle--${p.tone}`}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              '--dx': `${p.dx}px`,
              '--dur': `${p.duration}s`,
              '--delay': `${p.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

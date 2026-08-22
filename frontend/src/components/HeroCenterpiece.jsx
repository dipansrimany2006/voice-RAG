// The Home hero's signature visual — a hollow rounded triangle with
// glowing gold edges, a luminous glass-like orb floating inside it, thin
// tilted orbital rings, and a scatter of drifting particles. Pure CSS/SVG
// (no Three.js dependency in this project yet, no canvas, no per-frame
// React state) — every motion is a CSS keyframe running continuously by
// default (see index.css's ".hero-orb*" rules), only toned down — never
// fully removed — under prefers-reduced-motion.
const PARTICLES = [
  { top: 8, left: 18, size: 2.5, tone: 'gold' },
  { top: 14, left: 82, size: 2, tone: 'ivory' },
  { top: 78, left: 12, size: 2, tone: 'gold' },
  { top: 86, left: 76, size: 2.5, tone: 'gold' },
  { top: 4, left: 52, size: 1.5, tone: 'ivory' },
  { top: 50, left: 4, size: 1.5, tone: 'gold' },
  { top: 46, left: 96, size: 1.5, tone: 'ivory' },
  { top: 94, left: 46, size: 1.5, tone: 'gold' },
]

export default function HeroCenterpiece() {
  return (
    <div className="hero-orb" aria-hidden="true">
      <span className="hero-orb__ground-glow" />

      <div className="hero-orb__particles">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`hero-orb__particle hero-orb__particle--${p.tone}`}
            style={{ top: `${p.top}%`, left: `${p.left}%`, width: `${p.size}px`, height: `${p.size}px`, '--i': i }}
          />
        ))}
      </div>

      <div className="hero-orb__triangle-wrap">
        <svg className="hero-orb__triangle" viewBox="0 0 220 200" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="heroTriGrad" x1="10%" y1="0%" x2="90%" y2="100%">
              <stop offset="0%" stopColor="var(--hero-emerald-bright, #ffd966)" />
              <stop offset="55%" stopColor="var(--hero-gold, #f4c542)" />
              <stop offset="100%" stopColor="var(--hero-sunset-deep, #b8781f)" />
            </linearGradient>
          </defs>
          <path
            className="hero-orb__triangle-glow"
            d="M110 14 L200 178 L20 178 Z"
            stroke="var(--hero-gold, #f4c542)"
            strokeWidth="14"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            className="hero-orb__triangle-line"
            d="M110 14 L200 178 L20 178 Z"
            stroke="url(#heroTriGrad)"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* the traveling light pulse — a short bright dash chasing its way
              around the triangle's perimeter, looping forever. pathLength=1
              normalizes the dash math to a 0-1 fraction regardless of the
              path's real geometric length, so the dash/gap sizes below stay
              correct no matter how the triangle's own d= changes. */}
          <path
            className="hero-orb__triangle-pulse"
            d="M110 14 L200 178 L20 178 Z"
            stroke="#fff7e0"
            strokeWidth="5"
            strokeLinecap="round"
            pathLength="1"
          />
        </svg>
      </div>

      <div className="hero-orb__stage">
        {/* rings 1 and 3 render behind the sphere; ring 2 renders in front
            of it (DOM order after .hero-orb__sphere below) — together they
            read as orbits genuinely passing both behind and in front of
            the orb, not just sitting under it. */}
        <span className="hero-orb__orbit hero-orb__orbit--1" />
        <span className="hero-orb__orbit hero-orb__orbit--3" />

        <span className="hero-orb__sphere">
          <span className="hero-orb__sphere-highlight" />
          <span className="hero-orb__sphere-core-glow" />
          <span className="hero-orb__sphere-rim" />
        </span>

        <span className="hero-orb__orbit hero-orb__orbit--2" />
      </div>
    </div>
  )
}

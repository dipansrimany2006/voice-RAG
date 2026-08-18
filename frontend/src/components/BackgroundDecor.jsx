// Fixed, pointer-events-none, sitewide grain texture only. Every other
// atmospheric element (glows, particles, grids, botanicals) is now specific
// to the section it sits behind — see BeachScene, SectionAtmosphere, and the
// per-component decorative layers — so the same dot pattern doesn't repeat
// down the whole page. Paused under prefers-reduced-motion via index.css.
export default function BackgroundDecor() {
  return (
    <div className="bg-decor" aria-hidden="true">
      <div className="bg-decor__grain" />
    </div>
  )
}

import { useEffect, useRef } from 'react'

// An interactive dot-grid backdrop — a faint grid-line + dot pattern with
// a soft gold spotlight that follows the cursor and reveals brighter,
// warm-gold dots underneath it (the rest of the grid stays a faint
// neutral tone). Inspired by Aceternity UI's "background grid with dots
// and animations" component, rebuilt from scratch for this codebase — no
// external library, and the signature blue spotlight swapped for the
// site's own warm gold/amber identity (`--primary`/`--gold`), never blue.
//
// Pure CSS for the pattern itself (two tiled background-images); the only
// JS is a pointermove listener writing the cursor's position into CSS
// custom properties that a masked gold overlay reads — same ref-driven,
// no-React-state pattern already used for parallax elsewhere in this app
// (see Hero.jsx), so this costs nothing beyond the pointer's own event
// rate and never triggers a re-render.
//
// `contained`: pass true when mounting this INSIDE a section that has its
// own `position: relative` and non-static stacking (like Hero.jsx's
// `.hero`, which needs its own instance since it paints an opaque
// background that would otherwise hide the page-level one entirely).
// Without this, the component defaults to `position: fixed` sized to the
// whole viewport — correct for a single page-level instance, but WRONG
// inside a section that scrolls: a `position: fixed` descendant never
// scrolls away with its container, so it stays glued to the viewport and
// visibly bleeds into every section scrolled underneath it afterward
// (this was a real bug, caught after mounting a second fixed instance
// inside Hero — it showed up as an unwanted grid overlay on later
// sections like VoiceJourney). `contained` switches it to
// `position: absolute` instead, so it scrolls and clips normally with its
// parent, and the pointer coordinates are measured relative to that
// parent rather than the viewport.
export default function BackgroundGridDots({ contained = false }) {
  const rootRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia('(pointer: coarse)').matches) return
    const el = rootRef.current
    if (!el) return

    let raf = null
    let pendingX = -400
    let pendingY = -400

    function apply() {
      raf = null
      el.style.setProperty('--grid-spot-x', `${pendingX}px`)
      el.style.setProperty('--grid-spot-y', `${pendingY}px`)
    }
    function handleMove(e) {
      if (contained) {
        const rect = el.getBoundingClientRect()
        pendingX = e.clientX - rect.left
        pendingY = e.clientY - rect.top
      } else {
        pendingX = e.clientX
        pendingY = e.clientY
      }
      if (raf === null) raf = requestAnimationFrame(apply)
    }
    function handleLeave() {
      // parks the spotlight off-screen rather than snapping to 0,0 (which
      // would flash the glow into the corner) whenever the pointer leaves
      pendingX = -400
      pendingY = -400
      if (raf === null) raf = requestAnimationFrame(apply)
    }

    // Always listens on window, never on `el` itself — every layer here
    // is `pointer-events: none` (purely decorative, must never intercept
    // clicks on real content above it), so it could never receive its own
    // pointer events directly.
    window.addEventListener('pointermove', handleMove, { passive: true })
    window.addEventListener('pointerleave', handleLeave)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerleave', handleLeave)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [contained])

  return (
    <div className={`bg-grid-dots${contained ? ' bg-grid-dots--contained' : ''}`} aria-hidden="true" ref={rootRef}>
      <div className="bg-grid-dots__base" />
      <div className="bg-grid-dots__spotlight" />
    </div>
  )
}

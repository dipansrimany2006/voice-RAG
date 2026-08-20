// Small shared line-icon set — kept dependency-free (hand-authored SVG).

export function MicIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
      <path d="M12 18v4" strokeLinecap="round" />
      <path d="M8 22h8" strokeLinecap="round" />
    </svg>
  )
}

let holoMicUid = 0

// The premium "holographic" mic glyph used inside the voice orb — a
// rounded capsule body with a glassy vertical highlight for a refraction
// hint, a gradient-stroked stand arc, and a stem/base. Every instance
// gets its own gradient id (a module counter, not React's useId — this
// only ever needs to be unique per mounted instance, not stable across
// SSR) so two icons on the same page never fight over one gradient def.
export function HoloMic({ width = 30, height = 30, className = '', ...props }) {
  const id = (holoMicUid += 1)
  const gradId = `holo-mic-grad-${id}`
  const glowId = `holo-mic-glow-${id}`
  return (
    <svg viewBox="0 0 32 32" width={width} height={height} className={className} {...props}>
      <defs>
        <linearGradient id={gradId} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="var(--bright-green)" />
          <stop offset="52%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--gold)" />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* stand arc + stem + base, all one gradient-stroked glyph */}
      <path
        d="M8 15.5a8 8 0 0 0 16 0"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2.1"
        strokeLinecap="round"
        filter={`url(#${glowId})`}
      />
      <path d="M16 23.5v3.6" stroke={`url(#${gradId})`} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M11.8 27.6h8.4" stroke={`url(#${gradId})`} strokeWidth="2.1" strokeLinecap="round" />
      {/* the capsule body — rounded top/bottom ellipses so it reads as a
          smooth organic capsule rather than a rounded-rect icon glyph */}
      <rect x="11.2" y="5.4" width="9.6" height="15.4" rx="4.8" fill={`url(#${gradId})`} filter={`url(#${glowId})`} />
      {/* glass refraction highlight down the capsule's left edge */}
      <rect x="13" y="7.4" width="2.1" height="10.6" rx="1.05" fill="rgba(255,255,255,0.55)" opacity="0.8" />
      <rect x="16.4" y="7.4" width="1" height="10.6" rx="0.5" fill="rgba(255,255,255,0.22)" />
    </svg>
  )
}

export function SendIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 12h15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PlayIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
      <path d="M7 5.5v13a1 1 0 0 0 1.53.85l10.5-6.5a1 1 0 0 0 0-1.7l-10.5-6.5A1 1 0 0 0 7 5.5Z" />
    </svg>
  )
}

export function PauseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
      <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
    </svg>
  )
}

export function CopyIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5.5 15H4a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 4 2.5h9.5A1.5 1.5 0 0 1 15 4v1.5" strokeLinecap="round" />
    </svg>
  )
}

export function CheckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" {...props}>
      <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RefreshIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5.3 15A8 8 0 0 0 19 8.3M18.7 9A8 8 0 0 0 5 15.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ChevronDownIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" {...props}>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SunIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path
        strokeLinecap="round"
        d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"
      />
    </svg>
  )
}

export function MoonIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />
    </svg>
  )
}

export function GlobeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5Z" />
    </svg>
  )
}

export function MenuIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  )
}

export function CloseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  )
}

export function WaveformIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 12v0M7 9v6M11 5v14M15 9v6M19 12v0" strokeLinecap="round" />
    </svg>
  )
}

export function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" strokeLinecap="round" />
    </svg>
  )
}

export function ChipIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path
        d="M9.5 7V3.5M14.5 7V3.5M9.5 20.5V17M14.5 20.5V17M7 9.5H3.5M7 14.5H3.5M20.5 9.5H17M20.5 14.5H17"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AlertIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" strokeLinejoin="round" />
      <path d="M12 9.5v4.2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function BoltIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M13 2.5 4.5 14h6l-1 7.5L18.5 10h-6l0.5-7.5Z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function SpeakerOnIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" strokeLinejoin="round" />
      <path d="M16.3 8.7a5 5 0 0 1 0 6.6" strokeLinecap="round" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
    </svg>
  )
}

export function SpeakerOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" strokeLinejoin="round" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" strokeLinecap="round" />
    </svg>
  )
}

export function ShieldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 3 4.5 5.5v5.2c0 5 3.2 8.4 7.5 9.8 4.3-1.4 7.5-4.8 7.5-9.8V5.5L12 3Z" strokeLinejoin="round" />
      <path d="M8.7 12.2l2.2 2.2 4.4-4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SparkleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 3.5c.5 3 2 4.5 5 5-3 .5-4.5 2-5 5-.5-3-2-4.5-5-5 3-.5 4.5-2 5-5Z" strokeLinejoin="round" />
      <path d="M19 15c.25 1.4.95 2.1 2.4 2.4-1.45.3-2.15 1-2.4 2.4-.25-1.4-.95-2.1-2.4-2.4 1.45-.3 2.15-1 2.4-2.4Z" strokeLinejoin="round" />
    </svg>
  )
}

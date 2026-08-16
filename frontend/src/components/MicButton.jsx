export default function MicButton({ recording, disabled, onClick }) {
  return (
    <button
      type="button"
      className={`mic-button${recording ? ' mic-button--recording' : ''}`}
      aria-pressed={recording}
      aria-label={recording ? 'Stop recording' : 'Start recording your question'}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="mic-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
          <path d="M12 18v4" strokeLinecap="round" />
          <path d="M8 22h8" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  )
}

// Maps raw transport/gateway failures to a friendly, on-brand message.
// Messages that already come from the backend (guardrail explanations, "no
// index built yet", etc.) are left untouched since they're meaningful to the
// user — only generic infra failures get reworded.

const GATEWAY_PATTERNS = [
  /bad gateway/i,
  /gateway timeout/i,
  /service unavailable/i,
  /failed to fetch/i,
  /networkerror/i,
  /load failed/i,
  /^502/,
  /^503/,
  /^504/,
]

// `t` is the optional translate function from useLanguage() — when provided,
// the generic fallback message is localized; callers that don't pass it get
// the original English text unchanged.
export function friendlyError(message, t) {
  const unavailable = typeof t === 'function' ? t('status.unavailable') : 'Voice services are temporarily unavailable. Please try again in a moment.'
  if (!message) return unavailable
  const isGatewayIssue = GATEWAY_PATTERNS.some((pattern) => pattern.test(message))
  if (isGatewayIssue) return unavailable
  return message
}

export function isConnectionIssue(message) {
  if (!message) return true
  return GATEWAY_PATTERNS.some((pattern) => pattern.test(message))
}

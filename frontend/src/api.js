const BASE = '/api'

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function fetchStrategies() {
  const res = await fetch(`${BASE}/strategies`)
  return handle(res)
}

export async function queryText({ text, speak }) {
  const res = await fetch(`${BASE}/query/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speak }),
  })
  return handle(res)
}

export async function queryAudio({ blob, speak }) {
  const form = new FormData()
  form.append('file', blob, 'question.webm')
  form.append('speak', String(speak))
  const res = await fetch(`${BASE}/query/audio`, { method: 'POST', body: form })
  return handle(res)
}

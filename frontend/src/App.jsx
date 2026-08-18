import { useEffect, useState } from 'react'
import { fetchStrategies, queryAudio, queryText } from './api'
import { useRecorder } from './useRecorder'
import MicButton from './components/MicButton'
import AnswerPanel from './components/AnswerPanel'
import LatencyPanel from './components/LatencyPanel'

export default function App() {
  const [ready, setReady] = useState(false)
  const [strategiesError, setStrategiesError] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [lastAction, setLastAction] = useState(null)

  const recorder = useRecorder()

  useEffect(() => {
    fetchStrategies()
      .then((data) => {
        if (data.strategies.length > 0) setReady(true)
        else setStrategiesError('No chunking-strategy indexes are built yet. Run scripts/build_index.py first.')
      })
      .catch((err) => setStrategiesError(err.message))
  }, [])

  async function runQuery(action) {
    setStatus('loading')
    setErrorMessage(null)
    setLastAction(() => action)
    try {
      const data = await action()
      setResult(data)
      setStatus('success')
    } catch (err) {
      setErrorMessage(err.message)
      setStatus('error')
    }
  }

  async function handleTextSubmit(e) {
    e.preventDefault()
    if (!textInput.trim()) return
    const text = textInput.trim()
    runQuery(() => queryText({ text }))
  }

  async function handleMicClick() {
    if (recorder.state === 'recording') {
      const blob = await recorder.stop()
      if (blob) runQuery(() => queryAudio({ blob }))
      return
    }
    await recorder.start()
  }

  const micDisabled = !recorder.isSupported || !ready || status === 'loading'
  const micStatusText = !recorder.isSupported
    ? 'Voice recording is not supported in this browser — use the text field instead.'
    : recorder.state === 'recording'
    ? 'Recording… tap again to stop and submit.'
    : status === 'loading'
    ? 'Processing your question…'
    : 'Tap to record a question, in any of 14 languages.'

  return (
    <div className="page">
      <header className="header">
        <h1>Voice RAG</h1>
        <p className="subtitle">
          Ask a question by voice or text, in any of 14 Indic languages — answers are grounded in
          ai4bharat/MSMARCO-XI passages. The chunking strategy is chosen automatically per question.
        </p>
      </header>

      <main className="layout">
        <section className="panel" aria-labelledby="ask-heading">
          <h2 id="ask-heading" className="panel-title">
            Ask
          </h2>

          {strategiesError && <p className="field-error">{strategiesError}</p>}

          <div className="mic-row">
            <MicButton
              recording={recorder.state === 'recording'}
              disabled={micDisabled}
              onClick={handleMicClick}
            />
            <p className="mic-status" role="status" aria-live="polite">
              {micStatusText}
            </p>
          </div>
          {recorder.error && <p className="field-error">{recorder.error}</p>}

          <form className="text-form" onSubmit={handleTextSubmit}>
            <label htmlFor="text-input">Or type your question</label>
            <div className="text-form-row">
              <input
                type="text"
                id="text-input"
                autoComplete="off"
                placeholder="భారత రాజధాని ఏది?"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <button type="submit" className="secondary-button" disabled={!ready || status === 'loading'}>
                Ask
              </button>
            </div>
          </form>
        </section>

        <section className="panel" aria-labelledby="answer-heading">
          <h2 id="answer-heading" className="panel-title">
            Answer
          </h2>
          <AnswerPanel
            status={status}
            result={result}
            error={errorMessage}
            onRetry={() => lastAction && runQuery(lastAction)}
          />
        </section>

        <section className="panel" aria-labelledby="latency-heading">
          <h2 id="latency-heading" className="panel-title">
            Latency
          </h2>
          <LatencyPanel status={status} result={result} />
        </section>
      </main>
    </div>
  )
}

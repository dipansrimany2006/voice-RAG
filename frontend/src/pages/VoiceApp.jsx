import { useEffect, useRef, useState } from 'react'
import { fetchSampleQueries, fetchStrategies, queryAudio, queryText } from '../api'
import { useRecorder } from '../useRecorder'
import VoiceCard from '../components/VoiceCard'
import AnswerPanel from '../components/AnswerPanel'
import BenchmarkPanel from '../components/BenchmarkPanel'
import { HowItWorks, About } from '../components/InfoSections'
import SupportedLanguages from '../components/SupportedLanguages'
import { AlertIcon } from '../components/Icons'
import { friendlyError } from '../errorMessages'
import { AskAtmosphere } from '../components/SectionAtmosphere'
import { useLanguage } from '../i18n/LanguageContext'
import { useSound } from '../SoundContext'

// Page 2: the actual product. Interaction-first — voice comes before any
// explanatory content — so all query/recorder state lives here rather than
// in the app shell, and the readiness check only fires once someone has
// actually reached the interaction surface. The workspace is one 3-column
// grid — controls / voice / answer — rather than a voice card followed by
// a separate answer section further down the page.
export default function VoiceApp() {
  const { t, language } = useLanguage()
  const { playSound } = useSound()
  const [ready, setReady] = useState(false)
  const [strategiesError, setStrategiesError] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [lastAction, setLastAction] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [frontendLatencyMs, setFrontendLatencyMs] = useState(null)
  const [voiceMode, setVoiceMode] = useState(true)
  // Real questions pulled from the indexed dataset — quick-test chips so a
  // visitor can try the product without recording audio or knowing what to
  // ask. Empty until the fetch resolves; no placeholder/fake queries shown.
  const [sampleQueries, setSampleQueries] = useState([])
  // Mirrors AnswerPanel's real TTS playback state, lifted up so the voice
  // orb (in VoiceCard) can react while the answer is actually being
  // spoken — no new audio logic, just a read of the existing state.
  const [systemSpeaking, setSystemSpeaking] = useState(false)

  const recorder = useRecorder()

  useEffect(() => {
    fetchStrategies()
      .then((data) => {
        if (data.strategies.length > 0) setReady(true)
        else setStrategiesError(t('status.noIndexes'))
      })
      .catch((err) => setStrategiesError(friendlyError(err.message, t)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchSampleQueries()
      .then((data) => setSampleQueries(data.queries))
      .catch(() => setSampleQueries([])) // quick-test chips are a nicety — fail silently, the mic/text input still work
  }, [])

  useEffect(() => {
    if (recorder.state !== 'recording') {
      setElapsedSeconds(0)
      return
    }
    const start = performance.now()
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - start) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [recorder.state])

  // sound is narrated by real state transitions only — a ref holds the
  // previous value so each effect fires exactly once per genuine change
  // (never on an unrelated re-render, never twice for the same change)
  const prevRecorderState = useRef(recorder.state)
  useEffect(() => {
    if (recorder.state !== prevRecorderState.current) {
      if (recorder.state === 'recording') playSound('listening')
      else if (recorder.state === 'error') playSound('error')
      prevRecorderState.current = recorder.state
    }
  }, [recorder.state, playSound])

  const prevStatus = useRef(status)
  useEffect(() => {
    if (status !== prevStatus.current) {
      if (status === 'loading') playSound('retrieving')
      else if (status === 'success') playSound('answerReady')
      else if (status === 'error') playSound('error')
      prevStatus.current = status
    }
  }, [status, playSound])

  async function runQuery(action) {
    setStatus('loading')
    setErrorMessage(null)
    setLastAction(() => action)
    const startedAt = performance.now()
    try {
      const data = await action()
      setFrontendLatencyMs(performance.now() - startedAt)
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
    runQuery(() => queryText({ text, speak: voiceMode }))
  }

  function handleSampleQueryClick(text) {
    setTextInput(text)
    runQuery(() => queryText({ text, speak: voiceMode }))
  }

  async function handleMicClick() {
    if (recorder.state === 'recording') {
      const blob = await recorder.stop()
      if (blob) {
        playSound('detected')
        runQuery(() => queryAudio({ blob, speak: voiceMode }))
      }
      return
    }
    playSound('activate')
    await recorder.start()
  }

  function handleAskAgain() {
    setStatus('idle')
    setResult(null)
    setErrorMessage(null)
    setTextInput('')
    document.getElementById('ask')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => document.getElementById('text-input')?.focus(), 350)
  }

  const micDisabled = !recorder.isSupported || !ready || status === 'loading'
  // the idle-default hint ("recognizes all 14 languages...") is redundant
  // with the language selector and gets hidden — real states (unsupported
  // browser, an actual recorder error, or "recording…") still show through
  const micHintVisible = !recorder.isSupported || Boolean(recorder.error) || recorder.state === 'recording'
  const micStatusText = !recorder.isSupported
    ? t('ask.micHintUnsupported')
    : recorder.error
    ? recorder.error
    : recorder.state === 'recording'
    ? t('ask.micHintRecording')
    : t('ask.micHintIdle')

  return (
    <>
      <section className="ask-section ask-section--app">
        <AskAtmosphere />
        <div className="shell">
          {strategiesError && (
            <div className="inline-notice inline-notice--warn" role="alert">
              <AlertIcon className="inline-notice__icon" />
              <span>{strategiesError}</span>
            </div>
          )}

          <VoiceCard
            recording={recorder.state === 'recording'}
            micDisabled={micDisabled}
            micStatusText={micStatusText}
            micHintVisible={micHintVisible}
            onMicClick={handleMicClick}
            elapsedSeconds={elapsedSeconds}
            systemSpeaking={systemSpeaking}
            language={language}
            textInput={textInput}
            onTextInputChange={setTextInput}
            onTextSubmit={handleTextSubmit}
            sampleQueries={sampleQueries}
            onSampleQueryClick={handleSampleQueryClick}
            ready={ready}
            loading={status === 'loading'}
            resultReady={status === 'success'}
            hasError={status === 'error'}
            answerSlot={
              <AnswerPanel
                status={status}
                result={result}
                error={errorMessage}
                onRetry={() => lastAction && runQuery(lastAction)}
                onAskAgain={handleAskAgain}
                language={language}
                frontendLatencyMs={frontendLatencyMs}
                onSpeakingChange={setSystemSpeaking}
              />
            }
          />
        </div>
      </section>

      <section className="benchmark-section">
        <div className="shell">
          <BenchmarkPanel />
        </div>
      </section>

      <HowItWorks />
      <About />
      <SupportedLanguages />
    </>
  )
}

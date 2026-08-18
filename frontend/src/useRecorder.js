import { useCallback, useRef, useState } from 'react'

// 'idle' | 'recording' | 'error'
export function useRecorder() {
  const [state, setState] = useState('idle')
  const [error, setError] = useState(null)
  // also exposed as reactive state (see `stream` in the return value) —
  // read-only, purely for driving the live waveform visualization. Never
  // written to by anything outside start()/stop() below, so the actual
  // recording lifecycle is unchanged.
  const [stream, setStream] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  const start = useCallback(async () => {
    setError(null)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = mediaStream
      setStream(mediaStream)
      const recorder = new MediaRecorder(mediaStream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setState('recording')
    } catch (err) {
      setError(err.message || 'Microphone access was denied')
      setState('error')
    }
  }, [])

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder) {
        resolve(null)
        return
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        streamRef.current?.getTracks().forEach((track) => track.stop())
        setStream(null)
        setState('idle')
        resolve(blob)
      }
      recorder.stop()
    })
  }, [])

  return { state, error, start, stop, stream, isSupported: typeof MediaRecorder !== 'undefined' }
}

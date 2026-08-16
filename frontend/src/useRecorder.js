import { useCallback, useRef, useState } from 'react'

// 'idle' | 'recording' | 'error'
export function useRecorder() {
  const [state, setState] = useState('idle')
  const [error, setError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
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
        setState('idle')
        resolve(blob)
      }
      recorder.stop()
    })
  }, [])

  return { state, error, start, stop, isSupported: typeof MediaRecorder !== 'undefined' }
}

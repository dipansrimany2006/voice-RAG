import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LANGUAGES } from '../languages'
import { translations } from './translations'

const STORAGE_KEY = 'voice-rag-language'
const DEFAULT_CODE = 'en'

const LanguageContext = createContext(null)

function getInitialCode() {
  if (typeof localStorage === 'undefined') return DEFAULT_CODE
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored && LANGUAGES.some((l) => l.code === stored) ? stored : DEFAULT_CODE
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj)
}

// Single global source of truth for the selected language. The same
// selection drives both the UI translation (this context) and the existing
// spoken-language example placeholder in VoiceCard — one dropdown, one state.
export function LanguageProvider({ children }) {
  const [languageCode, setLanguageCode] = useState(getInitialCode)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, languageCode)
  }, [languageCode])

  // keeps document.documentElement.lang in sync so CSS can target script-
  // specific typography (line-height, sizing) via :lang() without any
  // extra plumbing, and so screen readers announce the right language
  useEffect(() => {
    document.documentElement.lang = languageCode
  }, [languageCode])

  const language = useMemo(
    () => LANGUAGES.find((l) => l.code === languageCode) || LANGUAGES[0],
    [languageCode],
  )

  // Accepts either a language object (as produced by the existing dropdowns)
  // or a bare code string, so no caller needs to change shape.
  const setLanguage = useCallback((langOrCode) => {
    const code = typeof langOrCode === 'string' ? langOrCode : langOrCode?.code
    if (code && LANGUAGES.some((l) => l.code === code)) setLanguageCode(code)
  }, [])

  const t = useCallback(
    (key) => {
      const dict = translations[languageCode] || translations[DEFAULT_CODE]
      const value = getPath(dict, key)
      if (typeof value === 'string') return value
      const fallback = getPath(translations[DEFAULT_CODE], key)
      return typeof fallback === 'string' ? fallback : key
    },
    [languageCode],
  )

  const value = useMemo(
    () => ({ language, languageCode, setLanguage, t }),
    [language, languageCode, setLanguage, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}

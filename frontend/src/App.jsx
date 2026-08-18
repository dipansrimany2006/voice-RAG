import { useEffect, useState } from 'react'
import BackgroundDecor from './components/BackgroundDecor'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import VoiceApp from './pages/VoiceApp'
import { useLanguage } from './i18n/LanguageContext'
import { useRouter } from './router'

// Sections that live only on the /app page and get scroll-spied for nav
// active-state while the visitor is on that page.
const APP_SECTION_IDS = ['how-it-works', 'about', 'languages']

function getInitialTheme() {
  // Dark HH-Goa is the primary brand identity now — default to it regardless
  // of OS preference; the toggle still lets a visitor opt into the lighter
  // alternate, and that choice is remembered.
  const stored = typeof localStorage !== 'undefined' && localStorage.getItem('voice-rag-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

export default function App() {
  const { language, setLanguage } = useLanguage()
  const { path } = useRouter()
  const [theme, setTheme] = useState(getInitialTheme)
  const [appSection, setAppSection] = useState(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('voice-rag-theme', theme)
  }, [theme])

  useEffect(() => {
    // fresh arrival on /app (or leaving it) always starts with nothing
    // credited as "active" — otherwise a stale section from a previous
    // visit, or the observer's first firing before any real scroll, could
    // highlight "How It Works" while the visitor is still looking at the
    // voice interface at the very top of the page.
    setAppSection(null)
    if (path !== '/app') return
    const sections = APP_SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean)
    if (sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (window.scrollY < 80) return
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setAppSection(visible[0].target.id)
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [path])

  const activeSection = path === '/' ? 'home' : appSection

  return (
    <div className="page">
      <BackgroundDecor />

      <Header
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        language={language}
        onLanguageChange={setLanguage}
        activeSection={activeSection}
      />

      <main>{path === '/app' ? <VoiceApp /> : <Home />}</main>

      <Footer />
    </div>
  )
}

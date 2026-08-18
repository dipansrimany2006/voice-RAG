import { useEffect, useRef, useState } from 'react'
import { SunIcon, MoonIcon, GlobeIcon, ChevronDownIcon, MenuIcon, CloseIcon, SpeakerOnIcon, SpeakerOffIcon } from './Icons'
import { LANGUAGES } from '../languages'
import { useLanguage } from '../i18n/LanguageContext'
import { useSound } from '../SoundContext'
import { useRouter } from '../router'

// "Home" leaves the app entirely for the landing page; "How It Works" and
// "About" live as sections on the /app page, so visiting them from the
// landing page has to navigate there first and then scroll.
const NAV_LINKS = [
  { id: 'home', route: '/', hash: null, labelKey: 'nav.home' },
  { id: 'how-it-works', route: '/app', hash: '#how-it-works', labelKey: 'nav.howItWorks' },
  { id: 'about', route: '/app', hash: '#about', labelKey: 'nav.about' },
]

export default function Header({ theme, onToggleTheme, language, onLanguageChange, activeSection }) {
  const { t } = useLanguage()
  const { muted, toggleMuted } = useSound()
  const { navigate } = useRouter()
  const [langOpen, setLangOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const langRef = useRef(null)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!langOpen) return
    function handlePointerDown(e) {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setLangOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [langOpen])

  function goTo(link) {
    navigate(link.route, link.hash ? { hash: link.hash } : undefined)
    setMenuOpen(false)
  }

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="site-header__inner">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand__text">
            <span className="brand__name">Voice RAG</span>
          </span>
        </a>

        <nav className="site-nav" aria-label={t('a11y.primaryNav')}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`${link.route}${link.hash || ''}`}
              className={`site-nav__link${activeSection === link.id ? ' is-active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                goTo(link)
              }}
            >
              {t(link.labelKey)}
            </a>
          ))}
        </nav>

        <div className="site-header__actions">
          <div className="lang-select" ref={langRef}>
            <button
              type="button"
              className="lang-select__trigger"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              onClick={() => setLangOpen((v) => !v)}
            >
              <GlobeIcon />
              <span>{language.label}</span>
              <ChevronDownIcon />
            </button>
            {langOpen && (
              <ul className="lang-select__menu" role="listbox">
                {LANGUAGES.map((lang) => (
                  <li key={lang.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={lang.code === language.code}
                      className={`lang-select__option${lang.code === language.code ? ' is-selected' : ''}`}
                      onClick={() => {
                        onLanguageChange(lang)
                        setLangOpen(false)
                      }}
                    >
                      {lang.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            className="theme-toggle"
            aria-label={muted ? t('a11y.unmuteSound') : t('a11y.muteSound')}
            aria-pressed={muted}
            onClick={toggleMuted}
          >
            {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
          </button>

          <button
            type="button"
            className="theme-toggle"
            aria-label={theme === 'dark' ? t('a11y.switchToLight') : t('a11y.switchToDark')}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            type="button"
            className="nav-menu-toggle"
            aria-label={menuOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="nav-menu-panel" aria-label={t('a11y.primaryNavMobile')}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`${link.route}${link.hash || ''}`}
              className={`nav-menu-panel__link${activeSection === link.id ? ' is-active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                goTo(link)
              }}
            >
              {t(link.labelKey)}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}

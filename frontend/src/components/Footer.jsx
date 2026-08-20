import { FooterAtmosphere } from './SectionAtmosphere'
import { useLanguage } from '../i18n/LanguageContext'
import { useRouter } from '../router'

const QUICK_LINKS = [
  { id: 'home', route: '/', hash: null, labelKey: 'nav.home' },
  { id: 'how-it-works', route: '/app', hash: '#how-it-works', labelKey: 'nav.howItWorks' },
  { id: 'about', route: '/app', hash: '#about', labelKey: 'nav.about' },
]

export default function Footer() {
  const { t } = useLanguage()
  const { navigate } = useRouter()

  return (
    <footer className="site-footer">
      <FooterAtmosphere />
      <div className="site-footer__inner">
        <div className="site-footer__brand-col">
          <span className="site-footer__brand">Vaani</span>
          <p className="site-footer__desc">{t('hero.subLine1')}</p>
        </div>

        <nav className="site-footer__links" aria-label="Footer">
          <span className="site-footer__links-title">{t('footer.quickLinks')}</span>
          <ul>
            {QUICK_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={`${link.route}${link.hash || ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(link.route, link.hash ? { hash: link.hash } : undefined)
                  }}
                >
                  {t(link.labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}

import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'

export default function Navbar() {
  const { lang, setLang, t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user: guestUser, loading: guestLoading, openGuestModal } = useGuestUser()

  const isGamePage = location.pathname.startsWith('/play/')

  const guestLabel = guestLoading
    ? '…'
    : /*(guestUser?.username ?? */ t('nav.guest') //)

  // v0.35.7 — same socials as the landing page; CSS hides them when the bar runs out of room.
  const socials = [
    { key: 'instagram', href: 'https://www.instagram.com/pathsgames/', icon: 'fab fa-instagram' },
    { key: 'youtube', href: 'https://www.youtube.com/channel/UCbrfVJJDmX-iBda6WhURPkQ', icon: 'fab fa-youtube' },
    { key: 'x', href: 'https://x.com/PathsGames', icon: 'fab fa-x-twitter' },
  ]

  return (
    <nav className="navbar-medieval">
      <a className="navbar-brand-pg" href="/">
        <i className="fas fa-dice-d20 navbar-dice" />
        <span className="navbar-brand-text">{t('nav.brand')}</span>
      </a>

      <div className="navbar-right">
        {isGamePage && (
          <button className="btn-secondary-pg navbar-home-btn" onClick={() => navigate('/')}>
            <i className="fas fa-home me-1" />{t('game.exitToHome')}
          </button>
        )}
        <div className={`navbar-social${isGamePage ? ' navbar-social--tight' : ''}`}>
          {socials.map(s => (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noopener"
              className="navbar-social-link"
              aria-label={t(`nav.${s.key}`)}
              title={t(`nav.${s.key}`)}
            >
              <i className={s.icon} />
            </a>
          ))}
        </div>

        <button
          className="nav-user-btn"
          title={guestUser?.username ?? t('nav.login')}
          onClick={openGuestModal}
        >
          <i className="fas fa-user-circle" />
          <span>{guestLabel}</span>
        </button>
      </div>
    </nav>
  )
}

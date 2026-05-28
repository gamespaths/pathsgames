import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import { useGuestUser } from '../../context/GuestUserContext'

export default function Navbar() {
  const { lang, setLang, t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user: guestUser, loading: guestLoading, openGuestModal } = useGuestUser()

  const isGamePage = location.pathname.startsWith('/play/')

  const guestLabel = guestLoading
    ? '…'
    : /*(guestUser?.username ?? */ t('nav.guest') //)

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

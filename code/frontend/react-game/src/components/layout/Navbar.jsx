import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'

export default function Navbar() {
  const { lang, setLang, t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [guestToast, setGuestToast] = useState(false)

  const isGamePage = location.pathname.startsWith('/play/')

  function handleGuestClick() {
    setGuestToast(true)
    setTimeout(() => setGuestToast(false), 3000)
  }

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
          className={`lang-btn ${lang === 'it' ? 'active' : ''}`}
          onClick={() => setLang('it')}
          title="Italiano"
        >
          IT
        </button>
        <button
          className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
          onClick={() => setLang('en')}
          title="English"
        >
          EN
        </button>

        <button className="nav-user-btn" title={t('nav.login')} onClick={handleGuestClick}>
          <i className="fas fa-user-circle" />
          <span>{t('nav.guest')}</span>
        </button>
      </div>

      {guestToast && (
        <div className="navbar-toast">
          <i className="fas fa-info-circle me-2" />
          {lang === 'it'
            ? '✦ Accesso non ancora disponibile — continui come ospite ✦'
            : '✦ Login not yet available — continuing as guest ✦'}
        </div>
      )}
    </nav>
  )
}

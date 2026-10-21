import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import { useHomeStatus } from '@/context/HomeStatusContext'
import EnvBadge from './EnvBadge'
import { rateLimitMessage } from '@/utils/rateLimit'
import { authErrorText } from '@/features/guest-user/UserAccountPanel'

export default function Navbar() {
  const { lang, setLang, t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user: guestUser, loading: guestLoading, openGuestModal, errorRetryAfter, isGoogleUser, googleEnabled,
    authError, clearAuthError } = useGuestUser()
  // v1.2.0 — a Google picture that fails to load falls back to the usual icon
  const [pictureFailed, setPictureFailed] = useState(false)
  const showPicture = isGoogleUser && guestUser?.pictureUrl && !pictureFailed
  // v0.37.6 — a failed home load (antibot / matches / stories) shows here with a refresh.
  const { error: homeError } = useHomeStatus()
  // v0.41.0 — the rate-limit sentence carries the wait the backend sent.
  const homeErrorText = homeError === 'rateLimited'
    ? rateLimitMessage(t, 'nav.error.rateLimited', errorRetryAfter)
    : homeError && t(`nav.error.${homeError}`)

  const isGamePage = location.pathname.startsWith('/play/')

  const guestLabel = guestLoading
    ? '…'
    : isGoogleUser ? (guestUser?.nickname ?? guestUser?.username) : t('nav.guest')
  // v1.2.0 — a session closed elsewhere (or a refused account) is said once, here
  const authAlert = ['SESSION_REVOKED', 'ACCOUNT_DISABLED', 'ACCOUNT_DELETION_IN_PROGRESS'].includes(authError)
    ? authErrorText(t, authError) : null

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
      <EnvBadge />

      {homeError && (
        <div className="navbar-error" role="alert">
          <i className="fas fa-exclamation-triangle me-1" />
          <span className="navbar-error__text">{homeErrorText}</span>
          <button className="navbar-error__btn" onClick={() => window.location.reload()}>
            <i className="fas fa-sync-alt me-1" />{t('nav.refresh')}
          </button>
        </div>
      )}

      {authAlert && (
        <div className="navbar-error" role="alert">
          <i className="fas fa-user-lock me-1" />
          <span className="navbar-error__text">{authAlert}</span>
          <button className="navbar-error__btn" onClick={clearAuthError}>{t('modals.close')}</button>
        </div>
      )}

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

        {!isGoogleUser && googleEnabled && !guestLoading && (
          <button className="btn-secondary-pg nav-signin-btn" onClick={() => openGuestModal()}
            title={t('auth.google.signIn')}>
            <i className="fab fa-google me-1" /><span className="nav-signin-btn__label">{t('auth.google.signInShort')}</span>
          </button>
        )}
        <button
          className={`nav-user-btn${isGoogleUser ? ' nav-user-btn--google' : ''}`}
          title={guestUser?.displayName ?? guestUser?.username ?? t('nav.login')}
          onClick={() => openGuestModal()}
        >
          {showPicture
            ? <img className="nav-user-avatar" src={guestUser.pictureUrl} alt="" width="32" height="32"
                referrerPolicy="no-referrer" onError={() => setPictureFailed(true)} />
            : <i className="fas fa-user-circle" />}
          <span className="nav-user-btn__label">{guestLabel}</span>
        </button>
      </div>
    </nav>
  )
}

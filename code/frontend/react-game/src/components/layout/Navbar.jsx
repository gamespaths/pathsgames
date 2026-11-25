import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../i18n/context'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import usePlayerPage from '@/features/guest-user/usePlayerPage'
import { useHomeStatus } from '@/context/HomeStatusContext'
import { useHomeButton } from '@/context/HomeButtonContext'
import EnvBadge from './EnvBadge'
import { rateLimitMessage } from '@/utils/rateLimit'
import { authErrorText } from '@/features/guest-user/UserAccountPanel'
import { SESSION_ALERT_CODES, SESSION_LIMIT } from '@/auth/sessionAlerts'

/** v1.13.0 — writes the bar's real height on <html> as `--navbar-h`; without a ResizeObserver the CSS fallback stays. */
export function useNavbarHeight(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver !== 'function') return undefined
    const root = document.documentElement
    const write = () => {
      const height = el.getBoundingClientRect().height
      if (height > 0) root.style.setProperty('--navbar-h', `${Math.round(height)}px`)
    }
    const observer = new ResizeObserver(write)
    observer.observe(el)
    write()
    return () => {
      observer.disconnect()
      root.style.removeProperty('--navbar-h')
    }
  }, [ref])
}

export default function Navbar() {
  const { t } = useTranslation()
  const { user: guestUser, loading: guestLoading, errorRetryAfter, isGoogleUser, googleEnabled,
    authError, clearAuthError } = useGuestUser()
  const { openPlayerPage } = usePlayerPage()
  const homeButton = useHomeButton()
  const navRef = useRef(null)
  useNavbarHeight(navRef)
  // v1.2.0 — a Google picture that fails to load falls back to the usual icon
  const [pictureFailed, setPictureFailed] = useState(false)
  const showPicture = isGoogleUser && guestUser?.pictureUrl && !pictureFailed
  // v0.37.6 — a failed home load (antibot / matches / stories) shows here with a refresh.
  const { error: homeError } = useHomeStatus()
  // v0.41.0 — the rate-limit sentence carries the wait the backend sent.
  const homeErrorText = homeError === 'rateLimited'
    ? rateLimitMessage(t, 'nav.error.rateLimited', errorRetryAfter)
    : homeError && t(`nav.error.${homeError}`)

  const guestLabel = guestLoading
    ? '…'
    : isGoogleUser ? (guestUser?.nickname ?? guestUser?.username) : t('nav.guest')
  const userTip = guestUser?.displayName ?? guestUser?.username ?? t('nav.login')
  // v1.2.0 — a session closed elsewhere (or a refused account) is said once, here
  const authAlert = SESSION_ALERT_CODES.includes(authError) ? authErrorText(t, authError) : null
  // v1.7.0 step 12 — too many devices: the alert opens the sign-in (v1.13.0: the player page)
  const signInAgain = () => {
    clearAuthError()
    openPlayerPage()
  }
  // v1.13.0 — the brand obeys the page's home handler (a running match opens the close card first).
  const onBrandClick = (e) => {
    if (!homeButton.hasHandler()) return
    e.preventDefault()
    homeButton.run()
  }

  // v0.35.7 — same socials as the landing page; CSS hides them when the bar runs out of room.
  const socials = [
    { key: 'instagram', href: 'https://www.instagram.com/pathsgames/', icon: 'fab fa-instagram' },
    { key: 'youtube', href: 'https://www.youtube.com/channel/UCbrfVJJDmX-iBda6WhURPkQ', icon: 'fab fa-youtube' },
    { key: 'x', href: 'https://x.com/PathsGames', icon: 'fab fa-x-twitter' },
  ]

  return (
    <nav className="navbar-medieval" ref={navRef}>
      <a className="navbar-brand-pg" href="/" onClick={onBrandClick}>
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
          {authError === SESSION_LIMIT && googleEnabled && (
            <button className="navbar-error__btn" onClick={signInAgain}>{t('auth.google.signInAgain')}</button>
          )}
          <button className="navbar-error__btn" onClick={clearAuthError}>{t('modals.close')}</button>
        </div>
      )}

      <div className="navbar-right">
        <div className="navbar-social">
          {socials.map(s => (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noopener"
              className="navbar-social-link"
              aria-label={t(`nav.${s.key}`)}
              data-tip={t(`nav.${s.key}`)}
            >
              <i className={s.icon} />
            </a>
          ))}
        </div>

        {!isGoogleUser && googleEnabled && !guestLoading && (
          <button className="btn-secondary-pg nav-signin-btn" onClick={() => openPlayerPage()}
            data-tip={t('auth.google.signIn')}>
            <i className="fab fa-google me-1" /><span className="nav-signin-btn__label">{t('auth.google.signInShort')}</span>
          </button>
        )}
        <button
          className={`nav-user-btn${isGoogleUser ? ' nav-user-btn--google' : ''}`}
          data-tip={userTip}
          onClick={() => openPlayerPage()}
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

import { useState } from 'react'
import { useTranslation } from '@/i18n/context'
import { usePolicyBook } from '@/context/PolicyBookContext'
import { useGuestUser } from './GuestUserContext'
import GoogleSignInButton from './GoogleSignInButton'

/** The message of an auth error code; an unknown code reads as the generic failure. */
export function authErrorText(t, code) {
  if (!code) return null
  const text = t(`auth.errors.${code}`)
  return text === `auth.errors.${code}` ? t('auth.errors.GOOGLE_LOGIN_FAILED') : text
}

const POLICY_TOKEN = /(\{privacy\}|\{terms\})/

/** The age notice with its {privacy} and {terms} tokens as links to the policy book. */
export function AgeNotice() {
  const { t } = useTranslation()
  const { openPolicyBook } = usePolicyBook()
  return String(t('auth.google.ageNotice')).split(POLICY_TOKEN).map((part, i) => {
    const kind = part === '{privacy}' ? 'privacy' : part === '{terms}' ? 'terms' : null
    return kind
      ? <button key={i} type="button" className="user-account-panel__policy" onClick={() => openPolicyBook(kind)}>
          {t(`footer.${kind}`)}</button>
      : part
  })
}

/** The round Google picture; without one, or when it fails to load, the fallback (none by default). */
export function UserAvatar({ url, className = 'user-avatar', fallback = null }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return fallback
  return <img className={className} src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

/** The message of a profile error code: profile text, then auth text, then the generic one. */
export function profileErrorText(t, code) {
  if (!code) return null
  for (const key of [`profile.errors.${code}`, `auth.errors.${code}`]) {
    const text = t(key)
    if (text !== key) return text
  }
  return t('profile.errors.generic')
}

/**
 * v1.8.0 — the "Log out" button of a Google user opens three choices: log out of this device, of
 * all devices, or delete the account; the last two each behind their own confirmation.
 */
export function LogoutMenu() {
  const { t } = useTranslation()
  const { user, logout, logoutAll, deleteAccount, authBusy, profileBusy, profileError, clearProfileError } = useGuestUser()
  const [view, setView] = useState('closed') // 'closed' | 'menu' | 'logoutAll' | 'delete'
  const error = profileErrorText(t, profileError)

  let body = null
  if (view === 'menu') {
    body = (
      <div className="user-profile__actions" data-testid="logout-menu">
        <button type="button" className="lang-btn" onClick={() => void logout()} disabled={authBusy}>
          <i className="fas fa-sign-out-alt me-2" />{t('auth.google.logoutThisDevice')}</button>
        <button type="button" className="lang-btn" onClick={() => setView('logoutAll')}>
          <i className="fas fa-power-off me-2" />{t('profile.logoutAll')}</button>
        <button type="button" className="lang-btn user-profile__danger" onClick={() => setView('delete')}>
          <i className="fas fa-user-slash me-2" />{t('profile.delete.button')}</button>
        {Number.isInteger(user?.activeSessions) && (
          <p className="user-profile__sessions" data-testid="active-sessions">
            {t('profile.activeSessions').replace('{count}', String(user.activeSessions))}</p>
        )}
      </div>
    )
  } else if (view === 'logoutAll') {
    body = (
      <div className="user-profile__confirm" data-testid="confirm-logout-all">
        <p>{t('profile.logoutAllConfirm')}</p>
        <button type="button" className="lang-btn" disabled={authBusy} onClick={() => void logoutAll()}>
          <i className="fas fa-sign-out-alt me-2" />{t('profile.confirm')}</button>
        <button type="button" className="lang-btn" onClick={() => setView('menu')}>{t('profile.cancel')}</button>
      </div>
    )
  } else if (view === 'delete') {
    body = (
      <div className="user-profile__confirm" data-testid="confirm-delete">
        <p>{t('profile.delete.what')}</p>
        <p>{t('profile.delete.confirmHint')}</p>
        <GoogleSignInButton onCredential={deleteAccount} labelKey="profile.delete.confirmWithGoogle"
          gisText="continue_with" busy={profileBusy} />
        {profileBusy && <p className="google-signin__status">{t('profile.delete.deleting')}</p>}
        <button type="button" className="lang-btn" disabled={profileBusy} onClick={() => setView('menu')}>
          {t('profile.cancel')}</button>
      </div>
    )
  }

  return (
    <>
      {/* the Log out button gives way to the three choices it opens */}
      {view === 'closed' && (
        <button type="button" className="lang-btn" onClick={() => setView('menu')}>
          <i className="fas fa-sign-out-alt me-2" />{t('auth.google.logout')}
        </button>
      )}
      {body}
      {error && (
        <p className="user-account-panel__error" role="alert">
          <i className="fas fa-exclamation-triangle me-1" />{error}
          <button type="button" className="btn-link-pg ms-2" onClick={clearProfileError}
            aria-label={t('modals.close')}>×</button>
        </p>
      )}
    </>
  )
}

/**
 * UserAccountPanel — v1.2.0 the account part of the user's book, inside the parchment body: a guest
 * is invited to sign in with Google to keep its progress; a Google user sees its account and the
 * logout menu (v1.8.0: this device, all devices, account deletion).
 */
export default function UserAccountPanel() {
  const { t } = useTranslation()
  const { user, isGoogleUser, authError, clearAuthError, googleEnabled, accountDeleted, closeGuestModal } = useGuestUser()
  const error = authErrorText(t, authError)
  if (accountDeleted) {
    return (
      <div className="user-account-panel" data-testid="user-profile-deleted">
        <p><strong>{t('profile.delete.doneTitle')}</strong></p>
        <p>{t('profile.delete.done')}</p>
        <button type="button" className="lang-btn" onClick={closeGuestModal}>{t('profile.delete.close')}</button>
      </div>
    )
  }
  return (
    <div className="user-account-panel" data-testid="user-account-panel">
      {error && (
        <p className="user-account-panel__error" role="alert">
          <i className="fas fa-exclamation-triangle me-1" />{error}
          <button type="button" className="btn-link-pg ms-2" onClick={clearAuthError}
            aria-label={t('modals.close')}>×</button>
        </p>
      )}
      {isGoogleUser ? (
        <>
          <p className="user-account-panel__who">
            {t('auth.google.signedInAs')} <strong>{user?.displayName}</strong>
            {user?.nickname && <span className="user-account-panel__nick"> ({user.nickname})</span>}
          </p>
          <LogoutMenu />
        </>
      ) : googleEnabled && (
        <>
          <br /><br />
          <p className="user-account-panel__invite">{t('auth.google.keepProgress')} <AgeNotice /></p>
          <GoogleSignInButton />
        </>
      )}
    </div>
  )
}

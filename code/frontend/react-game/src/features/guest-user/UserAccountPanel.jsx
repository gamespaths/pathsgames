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

/**
 * UserAccountPanel — v1.2.0 the account part of the user's book, inside the parchment body: a guest
 * is invited to sign in with Google to keep its progress; a Google user sees its account and the
 * logout. No account deletion here (it comes with the profile page of roadmap step 7).
 */
export default function UserAccountPanel() {
  const { t } = useTranslation()
  const { user, isGoogleUser, logout, authError, clearAuthError, authBusy, googleEnabled } = useGuestUser()
  const error = authErrorText(t, authError)
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
          <button type="button" className="lang-btn" onClick={() => void logout()} disabled={authBusy}>
            <i className="fas fa-sign-out-alt me-2" />{t('auth.google.logout')}
          </button>
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

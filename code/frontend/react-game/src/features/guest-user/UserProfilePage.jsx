import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { POLICY_KINDS } from '@/utils/policyPages'
import { profileStatRows } from '@/utils/profileStats'
import { useGuestUser } from './GuestUserContext'
import { UserAvatar } from './UserAccountPanel'
import UserLanguageSelector from './UserLanguageSelector'
import GoogleSignInButton from './GoogleSignInButton'

/** The message of a profile error code: profile text, then auth text, then the generic one. */
export function profileErrorText(t, code) {
  if (!code) return null
  for (const key of [`profile.errors.${code}`, `auth.errors.${code}`]) {
    const text = t(key)
    if (text !== key) return text
  }
  return t('profile.errors.generic')
}

/** Links to the static privacy, terms and cookies pages. */
export function PolicyLinks() {
  const { t } = useTranslation()
  const base = import.meta.env.BASE_URL ?? '/'
  return (
    <ul className="user-profile__policies">
      {POLICY_KINDS.map(kind => (
        <li key={kind}>
          <a href={`${base}${kind}.html`} target="_blank" rel="noopener noreferrer">{t(`footer.${kind}`)}</a>
        </li>
      ))}
    </ul>
  )
}

/** Logout of all devices and account deletion, each behind its own confirmation (Google users only). */
function AccountActions() {
  const { t } = useTranslation()
  const { user, logoutAll, deleteAccount, authBusy, profileBusy } = useGuestUser()
  const [confirm, setConfirm] = useState(null) // null | 'logoutAll' | 'delete'

  if (confirm === 'logoutAll') {
    return (
      <div className="user-profile__confirm" data-testid="confirm-logout-all">
        <p>{t('profile.logoutAllConfirm')}</p>
        <button type="button" className="lang-btn" disabled={authBusy} onClick={() => void logoutAll()}>
          <i className="fas fa-sign-out-alt me-2" />{t('profile.confirm')}</button>
        <button type="button" className="lang-btn" onClick={() => setConfirm(null)}>{t('profile.cancel')}</button>
      </div>
    )
  }
  if (confirm === 'delete') {
    return (
      <div className="user-profile__confirm" data-testid="confirm-delete">
        <p>{t('profile.delete.what')}</p>
        <p>{t('profile.delete.confirmHint')}</p>
        <GoogleSignInButton onCredential={deleteAccount} labelKey="profile.delete.confirmWithGoogle"
          gisText="continue_with" busy={profileBusy} />
        {profileBusy && <p className="google-signin__status">{t('profile.delete.deleting')}</p>}
        <button type="button" className="lang-btn" disabled={profileBusy} onClick={() => setConfirm(null)}>
          {t('profile.cancel')}</button>
      </div>
    )
  }
  return (
    <div className="user-profile__actions">
      {Number.isInteger(user?.activeSessions) && (
        <p className="user-profile__sessions" data-testid="active-sessions">
          {t('profile.activeSessions').replace('{count}', String(user.activeSessions))}</p>
      )}
      <button type="button" className="lang-btn" onClick={() => setConfirm('logoutAll')}>
        <i className="fas fa-power-off me-2" />{t('profile.logoutAll')}</button>
      <button type="button" className="lang-btn user-profile__danger" onClick={() => setConfirm('delete')}>
        <i className="fas fa-user-slash me-2" />{t('profile.delete.button')}</button>
    </div>
  )
}

/**
 * UserProfilePage — v1.7.0 the profile page of the user's book: who the player is, the statistics,
 * the preferences, the policy links; a Google user also logs out everywhere or deletes the account.
 */
export default function UserProfilePage({ onClose }) {
  const { t } = useTranslation()
  const { user, isGoogleUser, googleEnabled, refreshProfile, profileError, clearProfileError, accountDeleted,
    closeGuestModal } = useGuestUser()
  const refresh = useRef(refreshProfile)
  refresh.current = refreshProfile

  // fresh statistics each time the page opens
  useEffect(() => { void refresh.current?.() }, [])

  if (accountDeleted) {
    const done = (
      <div className="user-profile" data-testid="user-profile-deleted">
        <p>{t('profile.delete.done')}</p>
        <button type="button" className="lang-btn" onClick={closeGuestModal}>{t('profile.delete.close')}</button>
      </div>
    )
    return <Card variant="page" card={{ title: t('profile.delete.doneTitle') }} loading={false} extraContent={done} hidePreview />
  }

  const error = profileErrorText(t, profileError)
  const name = user?.displayName ?? user?.nickname ?? user?.username ?? t('modals.guestUser.anonymous')
  const content = (
    <div className="user-profile" data-testid="user-profile">
      <div className="user-profile__who">
        <UserAvatar url={user?.pictureUrl} className="user-profile__avatar" />
        <dl className="user-profile__list">
          <dt>{t('profile.displayName')}</dt><dd>{name}</dd>
          {user?.nickname && <><dt>{t('profile.nickname')}</dt><dd>{user.nickname}</dd></>}
          <dt>{t('profile.accountType')}</dt><dd>{t(`profile.accountTypes.${user?.accountType ?? 'GUEST'}`)}</dd>
        </dl>
      </div>

      <h3 className="user-profile__title">{t('profile.statsTitle')}</h3>
      <dl className="user-profile__list user-profile__stats" data-testid="user-profile-stats">
        {profileStatRows(user?.stats, t).map(row => (
          <div key={row.key} className="user-profile__stat" data-testid={`stat-${row.key}`}>
            <dt>{row.label}</dt><dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {!isGoogleUser && googleEnabled && <p className="user-profile__invite">{t('profile.guestInvite')}</p>}

      <h3 className="user-profile__title">{t('profile.preferencesTitle')}</h3>
      <UserLanguageSelector />

      {error && (
        <p className="user-account-panel__error" role="alert">
          <i className="fas fa-exclamation-triangle me-1" />{error}
          <button type="button" className="btn-link-pg ms-2" onClick={clearProfileError}
            aria-label={t('modals.close')}>×</button>
        </p>
      )}

      {isGoogleUser && <>
        <h3 className="user-profile__title">{t('profile.accountTitle')}</h3>
        <AccountActions />
      </>}

      <h3 className="user-profile__title">{t('profile.policiesTitle')}</h3>
      <PolicyLinks />
    </div>
  )
  return <Card variant="page" card={{ title: t('profile.title') }} loading={false} onClose={onClose}
    extraContent={content} hidePreview />
}

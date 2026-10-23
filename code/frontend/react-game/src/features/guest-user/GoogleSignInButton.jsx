import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/i18n/context'
import { useGuestUser } from './GuestUserContext'
import { loadGis, newNonce } from '@/auth/gisLoader'

/**
 * GoogleSignInButton — v1.2.0 "Sign in with Google" (GIS popup, no One Tap, no callback page).
 * The GIS script is loaded only after the first click; then the official button (filled_black,
 * pill) opens the Google popup and its credential goes to POST /api/auth/google.
 * Hidden when the server reports google-enabled false; the minimum-age line is in UserAccountPanel.
 */
export default function GoogleSignInButton({ compact = false, onCredential = null, labelKey = 'auth.google.signIn',
  gisText = 'signin_with', busy = null }) {
  const { t } = useTranslation()
  const { googleEnabled, googleClientId, loginWithGoogle, authBusy } = useGuestUser()
  const [phase, setPhase] = useState('idle') // idle | loading | ready | unavailable
  const slot = useRef(null)
  // v1.7.0 the credential goes to the login, or to `onCredential` (the fresh token of the account deletion)
  const handler = useRef(null)
  handler.current = onCredential ?? loginWithGoogle
  const working = busy ?? authBusy

  useEffect(() => {
    if (phase !== 'ready') return undefined
    let cancelled = false
    loadGis().then((gis) => {
      if (cancelled || !slot.current) return
      gis.initialize({
        client_id: googleClientId,
        nonce: newNonce(),
        ux_mode: 'popup',
        auto_select: false,
        callback: (response) => { if (response?.credential) void handler.current?.(response.credential) },
      })
      gis.renderButton(slot.current, { theme: 'filled_black', shape: 'pill', size: compact ? 'medium' : 'large',
        text: gisText })
    }).catch(() => { if (!cancelled) setPhase('unavailable') })
    return () => { cancelled = true }
  }, [phase, googleClientId, compact, gisText])

  if (!googleEnabled || !googleClientId) return null

  async function start() {
    setPhase('loading')
    try {
      await loadGis()
      setPhase('ready')
    } catch {
      setPhase('unavailable')
    }
  }

  return (
    <div className="google-signin" data-testid="google-signin">
      {phase === 'idle' && (
        <button type="button" className="lang-btn google-signin__btn" onClick={start} disabled={working}>
          <i className="fab fa-google me-2" />{t(labelKey)}
        </button>
      )}
      {phase === 'loading' && (
        <p className="google-signin__status"><i className="fas fa-spinner fa-spin me-2" />{t('auth.google.loading')}</p>
      )}
      {phase === 'unavailable' && (
        <p className="google-signin__status" role="alert">{t('auth.errors.PROVIDER_UNAVAILABLE')}</p>
      )}
      <div ref={slot} className="google-signin__slot" data-testid="google-signin-slot" hidden={phase !== 'ready'} />
      {working && <p className="google-signin__status"><i className="fas fa-spinner fa-spin me-2" />{t('auth.google.signingIn')}</p>}
    </div>
  )
}

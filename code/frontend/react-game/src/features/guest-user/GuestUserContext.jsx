import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useServer } from '@/context/ServerContext'
import { useTranslation } from '@/i18n/context'
import {
  createGuestSession, resumeGuestSession, googleLogin, refreshSession, getMe, logoutSession,
  updateMe, logoutAll as logoutAllSessions, deleteMe,
} from '@/api/auth'
import { getServerStatus } from '@/api/echoApi'
import { setUnauthorizedHandler } from '@/api/client'
import { whenIdle } from '@/api/inFlight'
import { takeNonce } from '@/auth/gisLoader'
import { deviceLanguage, devicePreferencesBody, setDeviceHighContrast } from '@/auth/devicePreferences'
import { hasBundle } from '@/i18n/bundles'
import usePageReturn from '@/hooks/usePageReturn'
import { openSessionChannel, withRefreshLock } from '@/auth/sessionSync'
import { reloadHome } from '@/auth/reloadHome'
import { RATE_LIMITED, isRateLimited, retryAfterSeconds } from '@/utils/rateLimit'
import { purgeKnownAccount } from '@/auth/knownAccount'
import { SESSION_ALERT_CODES } from '@/auth/sessionAlerts'

/**
 * GuestUserContext — owns the session of the player: a guest, or (v1.2.0) a Google user.
 *
 * No frontend cookie: identity lives in React state only. Persistence relies
 * entirely on the backend HttpOnly cookies (`pathsgames.guestcookie` +
 * `pathsgames.refreshToken`, see openapi/v0.12.0-guest-auth-api.yaml).
 *
 * Flow on mount (v1.2.0): refresh the session of the refresh cookie (a Google user keeps
 * its session across reloads), else resume the guest cookie, else create a new guest.
 * Signing in with Google links the current guest to the Google user (merge on the backend);
 * logout closes the session and reloads the home, whose mount resumes the previous guest (or
 * creates one). One tab refreshes at a time; login and logout reach the
 * other tabs through a BroadcastChannel.
 *
 * StrictMode-safe: `initRef` blocks the second dev-mode effect invocation so a
 * single network call runs per provider lifetime.
 */

const GuestUserContext = createContext(null)

// v0.41.0 — a 429 keeps its code and wait (seconds): the navbar turns them into a sentence.
function failure(e) {
  return isRateLimited(e)
    ? { error: RATE_LIMITED, retryAfter: retryAfterSeconds(e) }
    : { error: e?.message || 'guest-init-failed', retryAfter: 0 }
}

/** The API error code of a refused auth call (EMAIL_DOMAIN_NOT_ALLOWED, SESSION_REVOKED, …). */
export function authErrorCode(e, fallback = 'GOOGLE_LOGIN_FAILED') {
  const code = e?.response?.data?.error
  return typeof code === 'string' && code ? code : fallback
}

export function toIdentity(payload, profile = null) {
  if (!payload) return null
  const p = { ...payload, ...(profile ?? {}) }
  // `accessToken` is the JWT bearer token needed to call the protected match
  // endpoints (see api/matches.js).
  return {
    userUuid: p.userUuid,
    username: p.username,
    // v1.2.0 — the profile of GET /api/auth/me (or of the Google login answer)
    nickname: p.nickname ?? p.username ?? null,
    displayName: p.displayName ?? p.nickname ?? p.username ?? null,
    pictureUrl: p.pictureUrl ?? null,
    accountType: p.accountType ?? 'GUEST',
    role: p.role ?? 'PLAYER',
    // v1.7.0 — the preferences and the statistics of GET /api/auth/me
    language: p.language ?? null,
    preferences: p.preferences ?? null,
    stats: p.stats ?? null,
    // v1.7.0 step 12 — the sessions used in the last 30 days (profile page)
    activeSessions: Number.isInteger(p.activeSessions) ? p.activeSessions : null,
    accessToken: payload.accessToken ?? null,
    // v0.37.7 — echoed back as X-CSRF-TOKEN when a match is created (Step 41).
    csrfToken: payload.csrfToken ?? p.csrfToken ?? null,
  }
}

export function GuestUserProvider({ children }) {
  const { server } = useServer()
  const i18n = useTranslation()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [errorRetryAfter, setErrorRetryAfter] = useState(0)
  const [guestModalOpen, setGuestModalOpen] = useState(false)
  // Matches the guest modal will show. When the Home already fetched them (to
  // decide whether a story has an active match) it hands them over here, so
  // UserMatchesList can skip the redundant `GET /api/matches` call. `null`
  // means "not preloaded — fetch them". Cleared on close so a later open from
  // the navbar always fetches fresh data.
  const [matches, setMatches] = useState(null)
  // v1.2.0 — Google sign-in switch and client id (GET /api/echo/status), the last auth error
  // code, and `sessionIdle`: logged out with no guest to resume, a guest comes at the first Play.
  const [google, setGoogle] = useState({ enabled: false, clientId: null })
  const [authError, setAuthError] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [sessionIdle, setSessionIdle] = useState(false)
  // v1.7.0 — the profile page: server languages, last error, a save in progress, a deleted account
  const [supportedLanguages, setSupportedLanguages] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [profileBusy, setProfileBusy] = useState(false)
  const [accountDeleted, setAccountDeleted] = useState(false)
  // v1.7.0 step 9 — the matches the last login cancelled: the match list highlights them once
  const [highlightedMatchUuids, setHighlightedMatchUuids] = useState([])
  const initRef = useRef(false)
  const userRef = useRef(null)
  const channelRef = useRef(null)
  const i18nRef = useRef(i18n)
  const deletedRef = useRef(false)
  userRef.current = user
  i18nRef.current = i18n

  // `openGuestModal(matches?)` — callers that already have the match list (the
  // Home, to decide whether a story has an active match) pass it in so the
  // modal reuses it instead of re-fetching. Called with no argument (navbar) it
  // leaves `matches` null and the modal fetches them.
  const openGuestModal  = useCallback((preloaded = null) => {
    setMatches(Array.isArray(preloaded) ? preloaded : null)
    setGuestModalOpen(true)
  }, [])
  const closeGuestModal = useCallback(() => {
    // v1.7.0 — after the account deletion nothing of the old session stays open
    if (deletedRef.current) { reloadHome(); return }
    setGuestModalOpen(false)
    setMatches(null)
  }, [])

  /** v1.7.0 — a Google profile wins over the device; a new language waits until no request is in flight. */
  const applyProfile = useCallback((profile) => {
    if (profile?.accountType !== 'GOOGLE') return
    setDeviceHighContrast(profile.preferences?.highContrast)
    const language = profile.preferences?.language ?? profile.language
    if (!hasBundle(language)) return
    void whenIdle().then(() => {
      const current = i18nRef.current
      if (current?.setLang && current.lang !== language) current.setLang(language)
    })
  }, [])

  /** The identity of a refreshed or logged session, completed with GET /api/auth/me. */
  const withProfile = useCallback(async (payload) => {
    if (!payload?.accessToken) return null
    try {
      const me = await getMe(server, payload.accessToken)
      applyProfile(me)
      return toIdentity(payload, me)
    } catch {
      return toIdentity(payload)
    }
  }, [server, applyProfile])

  /** Refresh (one tab at a time), else the guest resume; answers the identity or null. */
  const restoreSession = useCallback(() => withRefreshLock(async () => {
    try {
      const identity = await withProfile(await refreshSession(server))
      if (identity) return identity
    } catch (e) {
      const code = authErrorCode(e, null)
      if (SESSION_ALERT_CODES.includes(code)) setAuthError(code)
    }
    try {
      return toIdentity(await resumeGuestSession(server))
    } catch {
      return null
    }
  }), [server, withProfile])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    purgeKnownAccount()

    setLoading(true)
    setError(null)
    void (async () => {
      try {
        let identity = await restoreSession()
        if (!identity) {
          setAuthError(null)
          identity = toIdentity(await createGuestSession(server))
        }
        if (identity) setUser(identity)
      } catch (e) {
        const f = failure(e)
        setError(f.error)
        setErrorRetryAfter(f.retryAfter)
      } finally {
        setLoading(false)
      }
    })()
  }, [server, restoreSession])

  // v1.2.0 — the Google sign-in switch and client id, read at runtime (no build variable).
  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => getServerStatus(server))
      .then((status) => {
        if (cancelled) return
        setGoogle({ enabled: status?.googleEnabled === true, clientId: status?.googleClientId ?? null })
        setSupportedLanguages(Array.isArray(status?.supportedLanguages) ? status.supportedLanguages : null)
      })
      .catch(() => { if (!cancelled) setGoogle({ enabled: false, clientId: null }) })
    return () => { cancelled = true }
  }, [server])

  // v1.2.0 — the first 401 (an old token, a session closed elsewhere): one refresh, else the
  // guest resume; nothing left means the home waits for the first Play.
  const handleUnauthorized = useCallback(async () => {
    const identity = await restoreSession()
    if (identity) {
      setUser(identity)
      return identity.accessToken
    }
    setUser(null)
    setSessionIdle(true)
    return null
  }, [restoreSession])

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized)
    return () => setUnauthorizedHandler(null)
  }, [handleUnauthorized])

  /** v1.7.0 — re-reads GET /api/auth/me (statistics, preferences of another device); a 401 refreshes. */
  const refreshProfile = useCallback(async () => {
    const current = userRef.current
    if (!current?.accessToken || deletedRef.current) return null
    try {
      const me = await getMe(server, current.accessToken)
      if (userRef.current?.accessToken !== current.accessToken) return null
      const identity = toIdentity(current, me)
      setUser(identity)
      applyProfile(me)
      return identity
    } catch (e) {
      if (e?.response?.status === 401) await handleUnauthorized()
      return null
    }
  }, [server, applyProfile, handleUnauthorized])

  usePageReturn(() => { void refreshProfile() }, { enabled: Boolean(user?.accessToken) })

  // v1.2.0 — another tab signed in or out: this one reloads its session.
  useEffect(() => {
    const channel = openSessionChannel((type) => {
      if (type === 'login' || type === 'logout') {
        void handleUnauthorized()
      }
    })
    channelRef.current = channel
    return () => channel.close()
  }, [handleUnauthorized])

  const refreshGuest = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const created = toIdentity(await createGuestSession(server))
      if (created) {
        setUser(created)
        setSessionIdle(false)
      }
    } catch (e) {
      const f = failure(e)
      setError(f.error)
      setErrorRetryAfter(f.retryAfter)
    } finally {
      setLoading(false)
    }
  }, [server])

  /** v1.2.0 — the guest of the first Play after a logout; resolves with the identity. */
  const ensureGuest = useCallback(async () => {
    if (userRef.current) return userRef.current
    const created = toIdentity(await createGuestSession(server))
    setUser(created)
    setSessionIdle(false)
    return created
  }, [server])

  const clearGuest = useCallback(() => {
    setUser(null)
  }, [])

  /** v1.7.0 — the profile after a login: a new user first gets the device values (one PATCH). */
  const profileAfterLogin = useCallback(async (data) => {
    const body = data?.newUser ? devicePreferencesBody() : null
    if (body) {
      try {
        return await updateMe(server, data.accessToken, data.csrfToken, body)
      } catch {
        // an unsupported device value: the plain profile is read below
      }
    }
    try {
      return await getMe(server, data?.accessToken)
    } catch {
      return null
    }
  }, [server])

  /** v1.2.0 — the GIS credential for a session; the current guest is linked by the backend. */
  const loginWithGoogle = useCallback(async (idToken) => {
    setAuthBusy(true)
    setAuthError(null)
    try {
      const data = await googleLogin(server,
        { idToken, nonce: takeNonce(), language: deviceLanguage() }, userRef.current?.accessToken)
      const profile = await profileAfterLogin(data)
      setHighlightedMatchUuids(Array.isArray(data?.cancelledMatchUuids) ? data.cancelledMatchUuids : [])
      setUser(toIdentity(data, profile))
      setSessionIdle(false)
      // v1.7.0 — the profile wins (for a new user it holds the device values just copied)
      applyProfile({ ...data, ...(profile ?? {}) })
      channelRef.current?.post('login')
      return true
    } catch (e) {
      setAuthError(authErrorCode(e))
      return false
    } finally {
      setAuthBusy(false)
    }
  }, [server, profileAfterLogin, applyProfile])

  /** v1.2.0 — Google logout: closes the session, tells the other tabs, reloads the home. */
  const logout = useCallback(async () => {
    setAuthBusy(true)
    try {
      await logoutSession(server, userRef.current?.accessToken)
    } catch {
      // the session may already be gone: the reload clears the local state anyway
    }
    channelRef.current?.post('logout')
    reloadHome()
  }, [server])

  const clearAuthError = useCallback(() => setAuthError(null), [])

  /** v1.7.0 — saves preferences: PATCH then the device for a Google user, the device only for a guest. */
  const savePreferences = useCallback(async (prefs) => {
    const current = userRef.current
    const applyDevice = () => {
      if (hasBundle(prefs?.language)) i18nRef.current?.setLang?.(prefs.language)
      setDeviceHighContrast(prefs?.highContrast)
    }
    setProfileError(null)
    if (current?.accountType !== 'GOOGLE') {
      applyDevice()
      return true
    }
    setProfileBusy(true)
    try {
      const me = await updateMe(server, current.accessToken, current.csrfToken, prefs)
      if (userRef.current?.accessToken === current.accessToken) setUser(toIdentity(current, me))
      applyDevice()
      return true
    } catch (e) {
      setProfileError(authErrorCode(e, 'PROFILE_SAVE_FAILED'))
      return false
    } finally {
      setProfileBusy(false)
    }
  }, [server])

  /** v1.7.0 — closes every session of the Google user, then the flow of a normal logout. */
  const logoutAll = useCallback(async () => {
    setAuthBusy(true)
    setProfileError(null)
    try {
      await logoutAllSessions(server, userRef.current?.accessToken)
    } catch (e) {
      setProfileError(authErrorCode(e, 'LOGOUT_ALL_FAILED'))
      setAuthBusy(false)
      return false
    }
    channelRef.current?.post('logout')
    reloadHome()
    return true
  }, [server])

  /** v1.7.0 — DELETE /api/auth/me with the fresh Google token of the confirmation popup. */
  const deleteAccount = useCallback(async (idToken) => {
    setProfileBusy(true)
    setProfileError(null)
    try {
      await deleteMe(server, userRef.current?.accessToken, { idToken, nonce: takeNonce() })
      deletedRef.current = true
      setAccountDeleted(true)
      channelRef.current?.post('logout')
      return true
    } catch (e) {
      setProfileError(authErrorCode(e, 'ACCOUNT_DELETION_FAILED'))
      return false
    } finally {
      setProfileBusy(false)
    }
  }, [server])

  const clearProfileError = useCallback(() => setProfileError(null), [])
  const consumeHighlightedMatches = useCallback(() => setHighlightedMatchUuids([]), [])

  return (
    <GuestUserContext.Provider value={{
      user, loading, error, errorRetryAfter, refreshGuest, clearGuest, guestModalOpen, openGuestModal,
      closeGuestModal, matches, setMatches,
      isGoogleUser: user?.accountType === 'GOOGLE', googleEnabled: google.enabled, googleClientId: google.clientId,
      loginWithGoogle, logout, authError, clearAuthError, authBusy, sessionIdle, ensureGuest,
      supportedLanguages, refreshProfile, savePreferences, logoutAll, deleteAccount, accountDeleted,
      profileError, clearProfileError, profileBusy, highlightedMatchUuids, consumeHighlightedMatches,
    }}>
      {children}
    </GuestUserContext.Provider>
  )
}

export function useGuestUser() {
  return useContext(GuestUserContext)
}

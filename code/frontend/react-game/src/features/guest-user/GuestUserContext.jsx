import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useServer } from '@/context/ServerContext'
import { useTranslation } from '@/i18n/context'
import {
  createGuestSession, resumeGuestSession, googleLogin, refreshSession, getMe, logoutSession,
} from '@/api/auth'
import { getServerStatus } from '@/api/echoApi'
import { setUnauthorizedHandler } from '@/api/client'
import { takeNonce } from '@/auth/gisLoader'
import { openSessionChannel, withRefreshLock } from '@/auth/sessionSync'
import { reloadHome } from '@/auth/reloadHome'
import { RATE_LIMITED, isRateLimited, retryAfterSeconds } from '@/utils/rateLimit'

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
const LANG_KEY = 'pathsgames.lang'

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
    accessToken: payload.accessToken ?? null,
    // v0.37.7 — echoed back as X-CSRF-TOKEN when a match is created (Step 41).
    csrfToken: payload.csrfToken ?? p.csrfToken ?? null,
  }
}

/** The language the player chose on this device, if any (it wins for a new Google user). */
function devicePreference() {
  try {
    return localStorage.getItem(LANG_KEY) || undefined
  } catch {
    return undefined
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
  const initRef = useRef(false)
  const userRef = useRef(null)
  const channelRef = useRef(null)
  userRef.current = user

  // `openGuestModal(matches?)` — callers that already have the match list (the
  // Home, to decide whether a story has an active match) pass it in so the
  // modal reuses it instead of re-fetching. Called with no argument (navbar) it
  // leaves `matches` null and the modal fetches them.
  const openGuestModal  = useCallback((preloaded = null) => {
    setMatches(Array.isArray(preloaded) ? preloaded : null)
    setGuestModalOpen(true)
  }, [])
  const closeGuestModal = useCallback(() => { setGuestModalOpen(false); setMatches(null) }, [])

  /** The identity of a refreshed or logged session, completed with GET /api/auth/me. */
  const withProfile = useCallback(async (payload) => {
    if (!payload?.accessToken) return null
    try {
      return toIdentity(payload, await getMe(server, payload.accessToken))
    } catch {
      return toIdentity(payload)
    }
  }, [server])

  /** Refresh (one tab at a time), else the guest resume; answers the identity or null. */
  const restoreSession = useCallback(() => withRefreshLock(async () => {
    try {
      const identity = await withProfile(await refreshSession(server))
      if (identity) return identity
    } catch (e) {
      const code = authErrorCode(e, null)
      if (code === 'SESSION_REVOKED' || code === 'ACCOUNT_DELETION_IN_PROGRESS' || code === 'ACCOUNT_DISABLED') {
        setAuthError(code)
      }
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
        if (!cancelled) setGoogle({ enabled: status?.googleEnabled === true, clientId: status?.googleClientId ?? null })
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

  /** v1.2.0 — the GIS credential for a session; the current guest is linked by the backend. */
  const loginWithGoogle = useCallback(async (idToken) => {
    setAuthBusy(true)
    setAuthError(null)
    try {
      const data = await googleLogin(server,
        { idToken, nonce: takeNonce(), language: devicePreference() }, userRef.current?.accessToken)
      setUser(toIdentity(data))
      setSessionIdle(false)
      // A new device without a chosen language follows the profile (guest choice > Google locale).
      if (!devicePreference() && data?.language && i18n?.setLang) i18n.setLang(data.language)
      channelRef.current?.post('login')
      return true
    } catch (e) {
      setAuthError(authErrorCode(e))
      return false
    } finally {
      setAuthBusy(false)
    }
  }, [server, i18n])

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

  return (
    <GuestUserContext.Provider value={{
      user, loading, error, errorRetryAfter, refreshGuest, clearGuest, guestModalOpen, openGuestModal,
      closeGuestModal, matches, setMatches,
      isGoogleUser: user?.accountType === 'GOOGLE', googleEnabled: google.enabled, googleClientId: google.clientId,
      loginWithGoogle, logout, authError, clearAuthError, authBusy, sessionIdle, ensureGuest,
    }}>
      {children}
    </GuestUserContext.Provider>
  )
}

export function useGuestUser() {
  return useContext(GuestUserContext)
}

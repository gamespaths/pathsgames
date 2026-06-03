import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useServer, MOCK_SERVER } from './ServerContext'
import { createGuestSession, resumeGuestSession } from '../api/auth'

/**
 * GuestUserContext — owns the guest identity used by the navbar/modal.
 *
 * No frontend cookie: identity lives in React state only. Persistence relies
 * entirely on the backend HttpOnly cookies (`pathsgames.guestcookie` +
 * `pathsgames.refreshToken`, see openapi/v0.12.0-guest-auth-api.yaml).
 *
 * Flow on mount:
 *   - real server → try `POST /api/auth/guest/resume` first (browser sends
 *     `pathsgames.guestcookie` automatically when `withCredentials:true`); on
 *     401/error fall back to `POST /api/auth/guest` to mint a brand-new guest.
 *   - mock server → synthesize an offline guest identity for this tab session.
 *
 * StrictMode-safe: `initRef` blocks the second dev-mode effect invocation so a
 * single network call (or no calls in mock) runs per provider lifetime.
 */

const GuestUserContext = createContext(null)

/**
 * Generates an opaque identifier for an offline (mock-server) guest.
 * Uses the Web Crypto API only — never Math.random — so the value is
 * unpredictable. This id is not security-critical (the mock guest never
 * touches a real backend) but a CSPRNG keeps it collision-resistant and
 * satisfies static-analysis checks.
 */
function mockGuestUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    return 'mock-' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  }
  // Non-browser environment with no Web Crypto — extremely unlikely.
  return 'mock-' + Date.now().toString(36)
}

function buildMockGuest() {
  const uuid = mockGuestUuid()
  return { userUuid: uuid, username: 'guest_' + uuid.slice(0, 8) }
}

function toIdentity(payload) {
  if (!payload) return null
  // `accessToken` is the JWT bearer token needed to call the protected match
  // endpoints (see api/matches.js). Mock guests have no token.
  return {
    userUuid: payload.userUuid,
    username: payload.username,
    accessToken: payload.accessToken ?? null,
  }
}

export function GuestUserProvider({ children }) {
  const { server } = useServer()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [guestModalOpen, setGuestModalOpen] = useState(false)
  // Matches the guest modal will show. When the Home already fetched them (to
  // decide whether a story has an active match) it hands them over here, so
  // UserMatchesList can skip the redundant `GET /api/matches` call. `null`
  // means "not preloaded — fetch them". Cleared on close so a later open from
  // the navbar always fetches fresh data.
  const [matches, setMatches] = useState(null)
  const initRef = useRef(false)

  // `openGuestModal(matches?)` — callers that already have the match list (the
  // Home, to decide whether a story has an active match) pass it in so the
  // modal reuses it instead of re-fetching. Called with no argument (navbar) it
  // leaves `matches` null and the modal fetches them.
  const openGuestModal  = useCallback((preloaded = null) => {
    setMatches(Array.isArray(preloaded) ? preloaded : null)
    setGuestModalOpen(true)
  }, [])
  const closeGuestModal = useCallback(() => { setGuestModalOpen(false); setMatches(null) }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    if (server === MOCK_SERVER) {
      setUser(buildMockGuest())
      return
    }

    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        let identity = null
        try {
          identity = toIdentity(await resumeGuestSession(server))
        } catch {
          // resume failed (no HttpOnly cookie yet, expired, or backend down) —
          // fall through to create.
        }
        if (!identity) {
          identity = toIdentity(await createGuestSession(server))
        }
        if (identity) setUser(identity)
      } catch (e) {
        setError(e?.message || 'guest-init-failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [server])

  const refreshGuest = useCallback(async () => {
    if (server === MOCK_SERVER) {
      setUser(buildMockGuest())
      return
    }
    setLoading(true)
    setError(null)
    try {
      const created = toIdentity(await createGuestSession(server))
      if (created) setUser(created)
    } catch (e) {
      setError(e?.message || 'guest-init-failed')
    } finally {
      setLoading(false)
    }
  }, [server])

  const clearGuest = useCallback(() => {
    setUser(null)
  }, [])

  return (
    <GuestUserContext.Provider value={{ user, loading, error, refreshGuest, clearGuest, guestModalOpen, openGuestModal, closeGuestModal, matches, setMatches }}>
      {children}
    </GuestUserContext.Provider>
  )
}

export function useGuestUser() {
  return useContext(GuestUserContext)
}

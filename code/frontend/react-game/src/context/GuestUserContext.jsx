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

function buildMockGuest() {
  const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'mock-' + Math.random().toString(36).slice(2, 10)
  return { userUuid: uuid, username: 'guest_' + uuid.slice(0, 8) }
}

function toIdentity(payload) {
  if (!payload) return null
  return { userUuid: payload.userUuid, username: payload.username }
}

export function GuestUserProvider({ children }) {
  const { server } = useServer()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const initRef = useRef(false)

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
    <GuestUserContext.Provider value={{ user, loading, error, refreshGuest, clearGuest }}>
      {children}
    </GuestUserContext.Provider>
  )
}

export function useGuestUser() {
  return useContext(GuestUserContext)
}

import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useGuestUser } from './GuestUserContext'
import { reloadHome } from '@/auth/reloadHome'

/**
 * usePlayerPage — v1.13.0: `openPlayerPage(preloaded?)` stores the caller's match list and goes to /player;
 * `closePlayerPage()` goes home (a reload after an account deletion). Inside the router: the context cannot navigate.
 */
export default function usePlayerPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { setMatches, accountDeleted } = useGuestUser() ?? {}

  const openPlayerPage = useCallback((preloaded = null) => {
    setMatches?.(Array.isArray(preloaded) ? preloaded : null)
    // Already there (navbar user button): no second history entry.
    if (pathname === '/player') navigate('/player', { replace: true })
    else navigate('/player')
  }, [setMatches, navigate, pathname])

  const closePlayerPage = useCallback(() => {
    // v1.7.0 — after the account deletion nothing of the old session stays open
    if (accountDeleted) { reloadHome(); return }
    navigate('/')
  }, [accountDeleted, navigate])

  return { openPlayerPage, closePlayerPage }
}

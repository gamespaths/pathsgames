import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import HomePage from '@/pages/HomePage'
import PlayerPage from '@/pages/PlayerPage'
import StoryPage from '@/pages/StoryPage'
import StartMatchPage from '@/pages/StartMatchPage'
import GamePage from '@/pages/GamePage'
import { usePolicyBook } from '@/context/PolicyBookContext'

/** Router state of the `*` redirect: the deep-link chapter it carries stays open. */
export const REDIRECT_STATE = { redirected: true }

/** A mistyped URL: back to the Home, the query string (e.g. `?policy=`) kept. */
function RedirectHome() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/', search }} replace state={REDIRECT_STATE} />
}

/**
 * AppRoutes — the application route table. v1.13.0 — a route change (not the first render, so the
 * `?policy=` deep link survives the load) closes an open policy chapter and starts the new page at the top.
 */
export default function AppRoutes() {
  const location = useLocation()
  const { closePolicyBook } = usePolicyBook()
  const lastPath = useRef(location.pathname)

  useEffect(() => {
    if (lastPath.current === location.pathname) return
    lastPath.current = location.pathname
    if (location.state?.redirected) return
    closePolicyBook({ restoreScroll: false })
    try {
      if (typeof window.scrollTo === 'function') window.scrollTo(0, 0)
    } catch {
      // no scrolling available (jsdom)
    }
  }, [location.pathname, location.state, closePolicyBook])

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/player" element={<PlayerPage />} />
      <Route path="/story/:storyId" element={<StoryPage />} />
      <Route path="/start-match/:storyId" element={<StartMatchPage />} />
      <Route path="/play/:storyId" element={<GamePage />} />
      <Route path="*" element={<RedirectHome />} />
    </Routes>
  )
}

import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import HomePage from '@/pages/HomePage'
import PlayerPage from '@/pages/PlayerPage'
import StoryPage from '@/pages/StoryPage'
import StartMatchPage from '@/pages/StartMatchPage'
import GamePage from '@/pages/GamePage'
import RouteBook from '@/components/book/RouteBook'
import { REDIRECT_STATE, bookOf } from '@/components/book/bookSwap'
import { usePolicyBook } from '@/context/PolicyBookContext'
import { useAnimationSettings } from '@/context/AnimationContext'
import { useTranslation } from '@/i18n/context'

export { REDIRECT_STATE }

/** A mistyped URL: back to the Home, the query string (e.g. `?policy=`) kept. */
function RedirectHome() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/', search }} replace state={REDIRECT_STATE} />
}

/** The routes on the shown location (step 15); its change, not the first nor a redirect, closes a chapter and goes up. */
function RouteTable({ location }) {
  const { closePolicyBook, notePath } = usePolicyBook()
  const lastPath = useRef(null)

  useEffect(() => {
    if (lastPath.current === location.pathname) return
    const first = lastPath.current === null
    lastPath.current = location.pathname
    const redirected = Boolean(location.state?.redirected)
    // An open chapter belongs to the page it opened on; the deep link's and a redirect's to the page they land on.
    notePath(location.pathname, (first || redirected) && !!bookOf(location.pathname))
    if (first || redirected) return
    closePolicyBook({ restoreScroll: false })
    try {
      if (typeof window.scrollTo === 'function') window.scrollTo(0, 0)
    } catch {
      // no scrolling available (jsdom)
    }
  }, [location.pathname, location.state, closePolicyBook, notePath])

  return (
    <Routes location={location}>
      <Route path="/" element={<HomePage />} />
      <Route path="/player" element={<PlayerPage />} />
      <Route path="/story/:storyId" element={<StoryPage />} />
      <Route path="/start-match/:storyId" element={<StartMatchPage />} />
      <Route path="/play/:storyId" element={<GamePage />} />
      <Route path="*" element={<RedirectHome />} />
    </Routes>
  )
}

/** AppRoutes — the application route table, inside the routes' book (step 15: book change, route turns, waiting). */
export default function AppRoutes() {
  const location = useLocation()
  const anim = useAnimationSettings()
  const i18n = useTranslation()
  return (
    <RouteBook location={location} anim={anim} t={i18n?.t}>
      {shown => <RouteTable location={shown} />}
    </RouteBook>
  )
}

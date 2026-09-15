import { useCallback, useEffect, useRef, useState } from 'react'
import { getMatchClock, getMatchWeather, getMatchLocations } from '@/api/matches'
import { buildLocationCosts } from '@/utils/gamebook'
import { CHROME_ALL } from './chromeScope'

/**
 * useMatchChrome — the three per-match side payloads the board reads but never owns: the
 * clock cycle, the current weather and the visited-locations map (with its move costs).
 *
 * They load together when the match is known and reload together after anything that can
 * advance time (a sleep, a movement, an executed event). All three are non-critical chrome:
 * a failed call leaves the previous value in place rather than blanking the board.
 */
export default function useMatchChrome(matchUuid, accessToken, lang) {
  const [clock, setClock] = useState(null)
  const [weather, setWeather] = useState(null)
  const [matchLocations, setMatchLocations] = useState(null)
  const [locationCosts, setLocationCosts] = useState({})
  // Answers that land after unmount are dropped instead of warning about a dead component.
  // Re-armed on mount, not only initialised: StrictMode mounts twice (mount → unmount →
  // mount) and the first unmount would otherwise leave every later answer discarded.
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const refreshClock = useCallback(async () => {
    if (!matchUuid) return
    try {
      const c = await getMatchClock(matchUuid, accessToken)
      if (aliveRef.current) setClock(c)
    } catch { /* non-critical: keep the previous clock */ }
  }, [matchUuid, accessToken])

  // Step 27 — a new time unit re-selects the weather, so this follows every clock advance.
  const refreshWeather = useCallback(async () => {
    if (!matchUuid) return
    try {
      const w = await getMatchWeather(matchUuid, accessToken)
      if (aliveRef.current) setWeather(w)
    } catch { /* non-critical: keep the previous weather */ }
  }, [matchUuid, accessToken])

  // Step 28 — the per-neighbor total energy cost; the weather changes it, hence the refresh.
  const refreshLocations = useCallback(async () => {
    if (!matchUuid) return
    try {
      const payload = await getMatchLocations(matchUuid, accessToken, lang)
      if (!aliveRef.current) return
      setMatchLocations(payload)
      setLocationCosts(buildLocationCosts(payload))
    } catch { /* non-critical: keep the previous cost map */ }
  }, [matchUuid, accessToken, lang])

  // v0.37.6 — `scope` says which of the three to ask again (default: all); see chromeScope.js.
  const refresh = useCallback((scope = CHROME_ALL) => {
    if (scope.clock) refreshClock()
    if (scope.weather) refreshWeather()
    if (scope.locations) refreshLocations()
  }, [refreshClock, refreshWeather, refreshLocations])

  // v0.37.6 — the mount-time load runs once per match/token/lang: StrictMode re-runs the
  // effect on its second mount and used to fire the three requests twice. A later
  // `refresh()` (after a sleep, a move, an event) is a fresh load and is never skipped.
  const loadedKey = useRef(null)
  useEffect(() => {
    const key = `${matchUuid}|${accessToken}|${lang}`
    if (loadedKey.current === key) return
    loadedKey.current = key
    refresh()
  }, [refresh, matchUuid, accessToken, lang])

  return { clock, weather, matchLocations, locationCosts, refresh }
}

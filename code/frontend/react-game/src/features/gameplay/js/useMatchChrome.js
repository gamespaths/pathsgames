import { useCallback, useEffect, useRef, useState } from 'react'
import { getMatchClock, getMatchWeather, getMatchLocations } from '@/api/matches'
import { buildLocationCosts } from '@/utils/gamebook'

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

  const refresh = useCallback(() => {
    refreshClock()
    refreshWeather()
    refreshLocations()
  }, [refreshClock, refreshWeather, refreshLocations])

  useEffect(() => { refresh() }, [refresh])

  return { clock, weather, matchLocations, locationCosts, refresh }
}

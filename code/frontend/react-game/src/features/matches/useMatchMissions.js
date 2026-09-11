import { useEffect, useState } from 'react'
import { getMatchMissions } from '@/api/matches'

/**
 * useMatchMissions — v0.37.4. The missions one match has reached, read off
 * GET /api/match/{uuid}/missions for the profile book, where no board holds them.
 * A null uuid reads as nothing to load; a failed call as an empty list.
 */
export default function useMatchMissions(matchUuid, accessToken, lang) {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!matchUuid) { setMissions([]); setLoading(false); return undefined }
    setLoading(true)
    getMatchMissions(matchUuid, accessToken, { lang })
      .then(data => { if (!cancelled) setMissions(Array.isArray(data?.missions) ? data.missions : []) })
      .catch(() => { if (!cancelled) setMissions([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [matchUuid, accessToken, lang])

  return { missions, loading }
}

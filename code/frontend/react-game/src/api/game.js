import { getMatchInfo as fetchMatchInfo } from './matches'

export class MatchNotRunningError extends Error {
  constructor(status) {
    super(`Match status is ${status}, not RUNNING`)
    this.name = 'MatchNotRunningError'
    this.status = status
  }
}

/**
 * Gameplay data client.
 *
 * `getMatchInfo` returns the backend `GET /api/match/{uuid}/info` payload
 * (MatchInfoResponse). It delegates to {@link fetchMatchInfo} so the call
 * carries the guest JWT and hits the real, match-scoped endpoint.
 *
 * Returns `null` when no match uuid is given or the backend returns no data.
 * Throws {@link MatchNotRunningError} if the match exists but its status is
 * not RUNNING (e.g. ENDED, GAMEOVER). Network/backend errors propagate to the
 * caller.
 */
export async function getMatchInfo(matchUuid, accessToken, lang) {
  if (!matchUuid) return null
  const data = await fetchMatchInfo(matchUuid, accessToken, lang)
  if (!data) return null
  if (data.match?.status !== 'RUNNING') {
    throw new MatchNotRunningError(data.match?.status)
  }
  return data
}

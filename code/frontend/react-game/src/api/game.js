import mockMatchInfo from '../mock/matchInfo.json'
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
 * Throws {@link MatchNotRunningError} if the match exists but its status is
 * not RUNNING (e.g. ENDED, GAMEOVER). Network failures and mock-server null
 * responses still fall back to `mock/matchInfo.json` so local dev works.
 */
export async function getMatchInfo(matchUuid, accessToken) {
  if (matchUuid) {
    let data = null
    try {
      data = await fetchMatchInfo(matchUuid, accessToken)
    } catch {
      // network / server errors fall through to the mock payload
    }
    if (data) {
      if (data.match?.status !== 'RUNNING') {
        throw new MatchNotRunningError(data.match?.status)
      }
      return data
    }
  }
  return mockMatchInfo
}

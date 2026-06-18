import mockMatchInfo from '../mock/matchInfo.json'
import { getMatchInfo } from './matches'

/**
 * Gameplay data client.
 *
 * `getGameData` returns the backend `GET /api/match/{uuid}/info` payload
 * (MatchInfoResponse). It delegates to {@link getMatchInfo} so the call carries
 * the guest JWT and hits the real, match-scoped endpoint. When there is no match
 * (no uuid), when running against the mock server (`getMatchInfo` returns null),
 * or when the request fails, it falls back to `mock/matchInfo.json` — which
 * deliberately mirrors the exact same JSON shape as the API.
 *
 * The board shape consumed by GameBook is produced from this object by
 * `matchInfoToGameData` in ./matchInfoAdapter.js.
 */
export async function getGameData(matchUuid, accessToken) {
  if (matchUuid) {
    try {
      const data = await getMatchInfo(matchUuid, accessToken)
      if (data) return data
    } catch {
      // fall through to the mock payload (same shape as the API)
    }
  }
  return mockMatchInfo
}

/** v1.7.0 step 8 — the matchVersion this device last saw per match, sent back as If-Match on every write. */
export const STALE_MATCH = 'STALE_MATCH'
export const STALE_EVENT = 'pathsgames:match-stale'

const versions = new Map()

export function getMatchVersion(matchUuid) {
  return matchUuid ? versions.get(matchUuid) ?? null : null
}

/** Keeps the version an answer carries (info, create, a write or a refusal after the claim). */
export function rememberMatchVersion(matchUuid, data) {
  const version = data?.matchVersion
  if (matchUuid && version !== undefined && version !== null && version !== '') {
    versions.set(matchUuid, String(version))
  }
}

/** Test seam: forget every version. */
export function clearMatchVersions() {
  versions.clear()
}

export function isStaleMatch(error) {
  const data = error?.response?.data
  return Boolean(error?.staleMatch)
    || (error?.response?.status === 409 && data?.error === STALE_MATCH)
    || error === STALE_MATCH
}

/** The If-Match header for a write on this match (none before the first version is known). */
export function ifMatchHeaders(matchUuid) {
  const version = getMatchVersion(matchUuid)
  return version ? { 'If-Match': version } : {}
}

/** One write with If-Match; STALE_MATCH is announced (STALE_EVENT) and rethrown, never re-sent. */
export async function versionedWrite(matchUuid, send) {
  try {
    const res = await send(ifMatchHeaders(matchUuid))
    rememberMatchVersion(matchUuid, res?.data)
    return res
  } catch (error) {
    if (isStaleMatch(error)) {
      error.staleMatch = true
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(STALE_EVENT, {
          detail: { matchUuid, matchVersion: error?.response?.data?.matchVersion ?? null },
        }))
      }
    } else {
      rememberMatchVersion(matchUuid, error?.response?.data)
    }
    throw error
  }
}

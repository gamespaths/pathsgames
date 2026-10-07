import { useEffect, useRef } from 'react'

/**
 * useMissionsCompleted — v0.38.2. Which missions CLOSED with the payload that just landed.
 *
 * A completion is news the board owes the player the moment it happens, not a mark on a tab
 * to be found later: the mission's own card turns up on the RIGHT reading page, with a back
 * arrow, the way the weather and an arrival's events already do.
 */
const missionKey = m => m?.uuid ?? m?.name ?? null

/**
 * The missions COMPLETED in `after` that were not in `before` — absent counts: a single-step
 * mission goes AVAILABLE → COMPLETED in one beat, and the board may never have seen it open.
 */
export function completedMissions(before, after) {
  const was = new Map((Array.isArray(before) ? before : [])
    .map(m => [missionKey(m), m?.status]))
  return (Array.isArray(after) ? after : [])
    .filter(m => m?.status === 'COMPLETED' && was.get(missionKey(m)) !== 'COMPLETED')
}

/**
 * @param {Array} missions      the missions as /info sends them
 * @param {Function} onCompleted called with the missions just closed, never with an empty list
 */
export default function useMissionsCompleted(missions, onCompleted) {
  // The first payload is the baseline, never news: a match resumed mid-story would otherwise
  // open on the card of a mission the player closed a week ago.
  const seen = useRef(null)
  const callback = useRef(onCompleted)
  useEffect(() => { callback.current = onCompleted }, [onCompleted])

  useEffect(() => {
    // No list at all is not "no missions": the baseline waits for a real payload.
    if (!Array.isArray(missions)) return
    const before = seen.current
    seen.current = missions
    if (before === null) return
    const closed = completedMissions(before, missions)
    if (closed.length > 0) callback.current?.(closed)
  }, [missions])
}

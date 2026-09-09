import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * useMissionsAlert — v0.37.1. Whether the missions have MOVED since the player last looked.
 *
 * The tab carries no number any more: a count says how many missions are open, which is not
 * the question a player asks between two turns. What they want to know is whether anything
 * happened — a mission opened, a step closed, a mission closed, a step appeared — and that is
 * one bit, not a number. The bit lights the tab and the click that opens the panel puts it out.
 *
 * The signature below is what "moved" means, and nothing else is: a status, how many steps a
 * mission has and how many of them are closed, per mission, in a stable order. A payload that
 * arrives re-sorted, or with a description rewritten, is NOT news.
 */
export function missionsSignature(missions) {
  const rows = Array.isArray(missions) ? missions : []
  return rows
    .map(m => {
      const steps = Array.isArray(m?.steps) ? m.steps : []
      const done = steps.filter(s => s?.done).length
      return `${m?.uuid ?? m?.name ?? '?'}:${m?.status ?? '?'}:${done}/${steps.length}`
    })
    .sort()
    .join('|')
}

/**
 * @param {Array} missions   the missions as /info sends them
 * @param {boolean} watching true while the player is ON the missions pages — news read as it
 *                           arrives is not news to announce, so the mark keeps up by itself
 * @returns {{ changed: boolean, markSeen: () => void }}
 */
export default function useMissionsAlert(missions, watching = false) {
  const signature = useMemo(() => missionsSignature(missions), [missions])
  // The first payload is the baseline, never an alert: a match resumed mid-story would
  // otherwise open with the tab lit for things the player has already read.
  const seen = useRef(null)
  const [changed, setChanged] = useState(false)

  const markSeen = useCallback(() => {
    seen.current = signature
    setChanged(false)
  }, [signature])

  useEffect(() => {
    if (seen.current === null || watching) {
      seen.current = signature
      setChanged(false)
      return
    }
    if (seen.current !== signature) {
      setChanged(true)
    }
  }, [signature, watching])

  return { changed, markSeen }
}

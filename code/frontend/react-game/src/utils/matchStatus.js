// Shared helpers to reason about a guest's matches per story.

// A match the player can jump back into.
export const ACTIVE_MATCH_STATUSES = new Set(['CREATED', 'RUNNING'])

// v0.32.1 — every non-terminal status. These occupy the player's slot on the
// story, so the backend refuses a second match (409 ACTIVE_MATCH_ALREADY_EXISTS).
// PAUSED is in here but NOT in ACTIVE_MATCH_STATUSES: an admin-paused match blocks
// a new run without being resumable, so it needs its own badge, not "resume".
export const BLOCKING_MATCH_STATUSES = new Set(['CREATED', 'RUNNING', 'PAUSED'])

/** True when the guest has an active (resumable) match for the given story. */
export function storyHasActiveMatch(matches, storyUuid) {
  return Array.isArray(matches) && matches.some(
    m => m.storyUuid === storyUuid && ACTIVE_MATCH_STATUSES.has(m.status)
  )
}

/**
 * True when the guest already has a match that prevents starting a new one on
 * this story — the client-side mirror of the backend guard.
 */
export function storyHasBlockingMatch(matches, storyUuid) {
  return Array.isArray(matches) && matches.some(
    m => m.storyUuid === storyUuid && BLOCKING_MATCH_STATUSES.has(m.status)
  )
}

/**
 * Badge to show on a StoryCard for the guest's matches of that story:
 *   'active'    → at least one resumable match (CREATED/RUNNING)
 *   'paused'    → no resumable match but one paused by an admin (v0.32.1)
 *   'completed' → nothing active or paused but at least one ENDED
 *   null        → nothing to show
 * Active wins over paused, paused over completed.
 */
export function storyMatchBadge(matches, storyUuid) {
  if (!Array.isArray(matches)) return null
  const mine = matches.filter(m => m.storyUuid === storyUuid)
  if (mine.some(m => ACTIVE_MATCH_STATUSES.has(m.status))) return 'active'
  if (mine.some(m => m.status === 'PAUSED')) return 'paused'
  if (mine.some(m => m.status === 'ENDED')) return 'completed'
  return null
}

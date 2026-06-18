// Shared helpers to reason about a guest's matches per story.

// A match the player can jump back into.
export const ACTIVE_MATCH_STATUSES = new Set(['CREATED', 'RUNNING'])

/** True when the guest has an active (resumable) match for the given story. */
export function storyHasActiveMatch(matches, storyUuid) {
  return Array.isArray(matches) && matches.some(
    m => m.storyUuid === storyUuid && ACTIVE_MATCH_STATUSES.has(m.status)
  )
}

/**
 * Badge to show on a StoryCard for the guest's matches of that story:
 *   'active'    → at least one resumable match (CREATED/RUNNING)
 *   'completed' → no active match but at least one ENDED
 *   null        → nothing to show
 * Active wins over completed.
 */
export function storyMatchBadge(matches, storyUuid) {
  if (!Array.isArray(matches)) return null
  const mine = matches.filter(m => m.storyUuid === storyUuid)
  if (mine.some(m => ACTIVE_MATCH_STATUSES.has(m.status))) return 'active'
  if (mine.some(m => m.status === 'ENDED')) return 'completed'
  return null
}

/**
 * Step 24 — turn priority projection for the admin console.
 *
 * The backend turn cycle computes a character's turn priority as:
 *   priority = (DEX*3 + INT*2 + COS*1) * 1000 + LIFE*10 + idCharacter
 * with the per-match integer character id as a deterministic tie-breaker.
 *
 * The admin match-info payload does not expose that integer id, so here we
 * reproduce the stat-driven part of the formula and tie-break on the character
 * uuid (stable, deterministic). This yields the *projected* turn order an admin
 * can inspect; it is a read-only projection, not the live queue state (there is
 * no admin-scoped turn-sequence endpoint — that endpoint is owner-restricted).
 */

const nz = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Stat-driven turn priority (higher acts first). */
export function computeTurnPriority(player) {
  const stats = nz(player?.dexterity) * 3 + nz(player?.intelligence) * 2 + nz(player?.constitution)
  return stats * 1000 + nz(player?.life) * 10
}

/**
 * Build the projected turn order from a list of player/character rows.
 * Returns a new array of `{ ...player, priority }` sorted by priority
 * descending, tie-broken by uuid for determinism.
 */
export function buildTurnOrder(players) {
  if (!Array.isArray(players)) return []
  return players
    .map((p) => ({ ...p, priority: computeTurnPriority(p) }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return String(a.uuid ?? '').localeCompare(String(b.uuid ?? ''))
    })
}

/** v1.7.0 — the statistics of GET /api/auth/me; v1.8.0 shown as the badges of the user's small card. */
export const PROFILE_STAT_BADGES = [
  { key: 'matchesPlayed',    icon: 'fas fa-scroll',          color: '#d4af37' },
  { key: 'matchesCompleted', icon: 'fas fa-flag-checkered',  color: '#27ae60' },
  { key: 'matchesGameOver',  icon: 'fas fa-skull',           color: '#c0392b' },
  { key: 'playTime',         icon: 'fas fa-hourglass-half',  color: '#3498db' },
]

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Whole hours and the minutes left of a play time in milliseconds. */
export function playTimeParts(ms) {
  const minutes = Math.floor(count(ms) / 60000)
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 }
}

/** v1.8.0 — the play time in one unit: minutes under an hour, hours under a day, else whole days. */
export function formatPlayTime(ms, t) {
  const { hours, minutes } = playTimeParts(ms)
  if (hours >= 24) return String(t('profile.stats.playTimeDays')).replace('{d}', String(Math.floor(hours / 24)))
  if (hours >= 1) return String(t('profile.stats.playTimeHours')).replace('{h}', String(hours))
  return String(t('profile.stats.playTimeMinutes')).replace('{m}', String(minutes))
}

/** The BonusBadgeList items { key, label, value, icon, color } of the statistics (zeros when the server sent none). */
export function profileStatBadges(stats, t) {
  const s = stats ?? {}
  return PROFILE_STAT_BADGES.map(({ key, icon, color }) => ({
    key, icon, color,
    label: t(`profile.stats.${key}`),
    value: key === 'playTime' ? formatPlayTime(s.playTimeMs, t) : String(count(s[key])),
  }))
}

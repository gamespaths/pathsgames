/** v1.7.0 — the statistics of GET /api/auth/me as the rows of the profile page. */
export const PROFILE_STAT_KEYS = ['matchesPlayed', 'matchesCompleted', 'matchesGameOver', 'playTime', 'clocksPlayed']

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Whole hours and the minutes left of a play time in milliseconds. */
export function playTimeParts(ms) {
  const minutes = Math.floor(count(ms) / 60000)
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 }
}

/** The play time as "{h} h {m} min" of the current language. */
export function formatPlayTime(ms, t) {
  const { hours, minutes } = playTimeParts(ms)
  return String(t('profile.stats.playTimeValue')).replace('{h}', String(hours)).replace('{m}', String(minutes))
}

/** The rows { key, label, value } of the statistics (zeros when the server sent none). */
export function profileStatRows(stats, t) {
  const s = stats ?? {}
  return PROFILE_STAT_KEYS.map(key => ({
    key,
    label: t(`profile.stats.${key}`),
    value: key === 'playTime' ? formatPlayTime(s.playTimeMs, t) : String(count(s[key])),
  }))
}

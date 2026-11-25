import { readAnimationEnv, resolveAnimations } from '@/constants/animations'
import { canVibrate } from '@/utils/haptics'

/* settings — step 16: the player's device preferences (pure). Stored choices are whitelisted; the effective
   settings are env defaults, then the choices, then the OS reduced motion (animation flags only). */

export const PREFERENCES_VERSION = 1
export const THEMES = Object.freeze(['medieval', 'parchment'])
export const SIZES = Object.freeze(['small', 'normal', 'large'])
export const COLUMN_OPTIONS = Object.freeze(['auto', 1, 2, 3, 4])
export const TURN_MODES = Object.freeze(['full', 'simple'])
export const SPEEDS = Object.freeze([0.25, 0.5, 1])
export const DECKS = Object.freeze(['under', 'over'])
export const ANIM_FLAGS = Object.freeze(['deal', 'dealFaceDown', 'play', 'turn'])
export const DEFAULT_THEME = 'medieval'
export const DEFAULT_SIZE = 'normal'
export const DEFAULT_COLUMNS = 'auto'

// Card columns per layout (`auto` = step 14's default); `tiny` is a phone under 331px: always one.
export const COLUMN_LIMITS = Object.freeze({
  desktop: Object.freeze({ min: 2, max: 4, auto: 3 }),
  medium: Object.freeze({ min: 1, max: 3, auto: 2 }),
  phone: Object.freeze({ min: 1, max: 2, auto: 2 }),
  sideways: Object.freeze({ min: 2, max: 3, auto: 3 }),
  tiny: Object.freeze({ min: 1, max: 1, auto: 1 }),
})

// First match wins, as the column rules of variables.css and preferences.css; none is the desktop.
export const COLUMN_LAYOUT_QUERIES = Object.freeze([
  ['tiny', '(max-width: 330px)'],
  ['sideways', '(orientation: landscape) and (max-height: 500px) and (min-width: 500px)'],
  ['phone', '(max-width: 767px)'],
  ['medium', '(max-width: 1120px)'],
])

const isBool = value => typeof value === 'boolean'
const oneOf = list => value => list.includes(value)
const ANIM_RULES = Object.freeze({
  deal: isBool, dealFaceDown: isBool, play: isBool, turn: isBool,
  turnMode: oneOf(TURN_MODES), speed: oneOf(SPEEDS), deck: oneOf(DECKS),
})

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value)

/** The stored preferences with every unknown or invalid value dropped ({} for anything but an object). */
export function sanitizePreferences(raw) {
  if (!isObject(raw) || (raw.v !== undefined && raw.v !== PREFERENCES_VERSION)) return {}
  const out = {}
  if (THEMES.includes(raw.theme)) out.theme = raw.theme
  if (SIZES.includes(raw.size)) out.size = raw.size
  if (COLUMN_OPTIONS.includes(raw.columns)) out.columns = raw.columns
  if (isBool(raw.vibration)) out.vibration = raw.vibration
  const anim = {}
  if (isObject(raw.anim)) {
    for (const [key, valid] of Object.entries(ANIM_RULES)) if (valid(raw.anim[key])) anim[key] = raw.anim[key]
  }
  if (Object.keys(anim).length > 0) out.anim = anim
  return out
}

/** The layout the card columns follow now (desktop without matchMedia). */
export function columnsLayout(matches = query => !!globalThis.window?.matchMedia?.(query)?.matches) {
  const hit = COLUMN_LAYOUT_QUERIES.find(([, query]) => matches(query))
  return hit ? hit[0] : 'desktop'
}

function limitsOf(layout) {
  return COLUMN_LIMITS[layout] ?? COLUMN_LIMITS.desktop
}

/** The columns shown for a choice in a layout: `auto` is the layout default, a number is clamped to its range. */
export function clampColumns(columns, layout) {
  const { min, max, auto } = limitsOf(layout)
  if (typeof columns !== 'number') return auto
  return Math.min(max, Math.max(min, columns))
}

/** Whether a column option can be chosen in a layout (`auto` always). */
export function columnAllowed(columns, layout) {
  if (columns === 'auto') return true
  const { min, max } = limitsOf(layout)
  return columns >= min && columns <= max
}

/** What applies now: theme, size, columns (stored and shown), the animation settings and the vibration. */
export function effectiveSettings({
  prefs = {}, animDefaults = readAnimationEnv(), reducedMotion = false, layout = 'desktop', vibrationApi = canVibrate(),
} = {}) {
  const p = prefs ?? {}
  const columns = p.columns ?? DEFAULT_COLUMNS
  return {
    theme: p.theme ?? DEFAULT_THEME,
    size: p.size ?? DEFAULT_SIZE,
    columns,
    cols: clampColumns(columns, layout),
    anim: resolveAnimations({ defaults: animDefaults, overrides: p.anim, reducedMotion }),
    vibration: p.vibration !== false && !!vibrationApi,
    reducedMotion: !!reducedMotion,
  }
}

/** The stored preferences with `path` ('theme', 'anim.speed', …) set to `value` (undefined removes it), whitelisted. */
export function withPreference(prefs, path, value) {
  const [head, key] = String(path).split('.')
  const next = { ...(prefs ?? {}) }
  if (key) next[head] = { ...(isObject(next[head]) ? next[head] : {}), [key]: value }
  else next[head] = value
  return sanitizePreferences(next)
}

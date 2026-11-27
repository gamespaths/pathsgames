import { parseFlag } from './features'

/**
 * Step 14 — animation settings: env defaults, player overrides (step 16), OS reduced motion wins.
 * One module read by AnimationContext; the CSS reads the timings as `--t-<key>` on <html>.
 */

// Cards of one batch that get their own delay: the ninth leaves with the eighth.
export const DEAL_MAX_STAGGER = 8
export const DEFAULT_SPEED = 0.25
export const SPEED_MIN = 0.1
export const SPEED_MAX = 4
export const DEFAULT_COVER_MAX = 10

// Concept base values in ms at speed 1 (play, turn, the (i) fade and the book change are step 15's).
// v1.15.0: `zoom` (the book change shrinks and grows the closed book), `gather` and `gatherStep` (the phone shuffle).
export const BASE_TIMINGS = Object.freeze({
  open: 650, close: 260, deal: 620, dealStep: 110, lift: 240, fly: 560,
  discard: 320, discardStep: 50, flip: 900, simple: 520, sheet: 620, fade: 200, slide: 600,
  zoom: 320, gather: 420, gatherStep: 60,
})

export const ANIMATION_FLAGS = Object.freeze(['deal', 'dealFaceDown', 'play', 'turn', 'cover'])

/** A finite number > 0, clamped to 0.1–4; anything else is the default 0.25. */
export function parseSpeed(value) {
  const n = Number(typeof value === 'string' ? value.trim() : value)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SPEED
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, n))
}

/** 'simple' or 'full' (anything else). */
export function parseTurnMode(value) {
  return String(value ?? '').trim().toLowerCase() === 'simple' ? 'simple' : 'full'
}

/** 'over' or 'under' (anything else): where the desktop deck pile lies against the book. */
export function parseDeck(value) {
  return String(value ?? '').trim().toLowerCase() === 'over' ? 'over' : 'under'
}

/** Step 15 — the longest book change in seconds: a finite number >= 0 (0 = no limit); anything else is 10. */
export function parseCoverMax(value) {
  const usable = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
  const n = usable ? Number(value) : NaN
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_COVER_MAX
}

/** The nine VITE_ANIM_* keys of a Vite env object, parsed with their defaults. */
export function readAnimationEnv(env = import.meta.env) {
  const e = env ?? {}
  return {
    deal: parseFlag(e.VITE_ANIM_DEAL, true),
    dealFaceDown: parseFlag(e.VITE_ANIM_DEAL_FACEDOWN, true),
    play: parseFlag(e.VITE_ANIM_PLAY, true),
    turn: parseFlag(e.VITE_ANIM_TURN, true),
    cover: parseFlag(e.VITE_ANIM_COVER, true),
    turnMode: parseTurnMode(e.VITE_ANIM_TURN_MODE),
    speed: parseSpeed(e.VITE_ANIM_SPEED),
    deck: parseDeck(e.VITE_ANIM_DECK),
    coverMax: parseCoverMax(e.VITE_ANIM_COVER_MAX_S),
  }
}

/** The base timings divided by the speed, rounded to whole ms. */
export function scaledTimings(speed) {
  return Object.fromEntries(Object.entries(BASE_TIMINGS).map(([key, ms]) => [key, Math.round(ms / speed)]))
}

const given = value => value !== undefined && value !== null && value !== ''

/** Effective settings: overrides win key by key over env (or parsed `defaults`); reduced motion turns every flag off (not `deck`); `coverMax` is env only. */
export function resolveAnimations({ env = import.meta.env, defaults = null, overrides = null, reducedMotion = false } = {}) {
  const base = defaults ?? readAnimationEnv(env)
  const o = overrides ?? {}
  const reduced = !!reducedMotion
  const settings = {}
  for (const key of ANIMATION_FLAGS) {
    settings[key] = !reduced && (given(o[key]) ? parseFlag(o[key], base[key]) : base[key])
  }
  settings.turnMode = given(o.turnMode) ? parseTurnMode(o.turnMode) : base.turnMode
  settings.speed = given(o.speed) ? parseSpeed(o.speed) : base.speed
  settings.deck = given(o.deck) ? parseDeck(o.deck) : base.deck
  settings.coverMax = base.coverMax ?? DEFAULT_COVER_MAX
  settings.reduced = reduced
  settings.timings = scaledTimings(settings.speed)
  return settings
}

/** Writes `--t-<key>: <ms>ms` on the root via the CSSOM (CSP-safe) and `data-pg-reduced` while reduced. */
export function applyAnimationTimings(settings, root = globalThis.document?.documentElement) {
  if (!root?.style || !settings?.timings) return
  for (const [key, ms] of Object.entries(settings.timings)) root.style.setProperty(`--t-${key}`, `${ms}ms`)
  if (settings.reduced) root.setAttribute('data-pg-reduced', 'true')
  else root.removeAttribute('data-pg-reduced')
}

// Cloudflare Turnstile shared config.
// CF_KEY falsy → widget disabled (dev bypass): callers skip the antibot check.
export const CF_KEY = import.meta.env.VITE_CF_TURNSTILE_KEY

// The widget render mode set per in-page element. Only 'interaction-only'
// (invisible until a challenge is needed) and 'always' (visible) are exposed;
// anything else falls back to 'always'. (Managed/invisible is also a property
// of the site key in the Cloudflare dashboard.)
function appearanceFor(value) {
  return value === 'interaction-only' ? 'interaction-only' : 'always'
}

export const TURNSTILE_APPEARANCE = {
  home:   appearanceFor(import.meta.env.VITE_TURNSTILE_APPEARANCE_HOME),
  config: appearanceFor(import.meta.env.VITE_TURNSTILE_APPEARANCE_START),
  guest:  appearanceFor(import.meta.env.VITE_TURNSTILE_APPEARANCE_GUEST),
}

// Once a visitor passes Turnstile we remember it in a first-party cookie so the
// pure gates (HomePage) don't re-run the widget on every visit. The embedded
// widget itself sets no reusable first-party cookie (cf_clearance only exists
// with Cloudflare Pre-Clearance), so we cache the *result* ourselves.
// NOTE: client-side UX only — real protection is the server-side token check on
// match creation. Never trust this cookie as a security control.
export const TURNSTILE_PASS_COOKIE = 'pathsgames.turnstilePass'

const _RAW_TTL = Number(import.meta.env.VITE_TURNSTILE_PASS_TTL_MINUTES)
export const TURNSTILE_PASS_TTL_MIN = Number.isFinite(_RAW_TTL) && _RAW_TTL > 0 ? _RAW_TTL : 30

// A live cookie (not yet expired by its max-age) means a recent human pass.
export function isTurnstilePassValid() {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').some(c => c.startsWith(`${TURNSTILE_PASS_COOKIE}=`))
}

export function recordTurnstilePass() {
  if (typeof document === 'undefined') return
  const maxAge = TURNSTILE_PASS_TTL_MIN * 60
  document.cookie = `${TURNSTILE_PASS_COOKIE}=1; max-age=${maxAge}; path=/; SameSite=Lax`
}

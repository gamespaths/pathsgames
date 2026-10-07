import { policyKindFromHref } from './policyDeepLink'

/**
 * Step 42 — card credits: the story and image credit notes shown in a page card's tip area.
 * Each note: { text, url, policy } — `policy` set when the url is the site's own `?policy=…` link.
 */
// Unless a story states otherwise, it is CC BY-NC-ND 4.0 (Terms of Service, point 5).
export const STORY_LICENSE = 'CC BY-NC-ND 4.0'
export const STORY_LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
export const UNSPLASH_LICENSE = 'Unsplash'
export const CREDIT_ICONS = { tip: 'fa-lightbulb', story: 'fa-book', image: 'fa-image' }

const FALLBACK = {
  'card.storyCredit': 'story credit', 'card.imageCredit': 'image credit',
  'card.storyBy': 'Story by {name}', 'card.imageBy': 'Image by {name}', 'card.withLicense': ' with {license} license',
  'card.openLink': 'open link',
}

/** `t` with an English fallback (isolated renders return the key) and `{var}` substitution. */
export function creditText(t, key, vars = {}) {
  const raw = t?.(key)
  const text = raw && raw !== key ? raw : (FALLBACK[key] ?? key)
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), text)
}

/** A link as written in the story data: a bare host (`paths.games`) becomes https. */
export function normalizeCreditUrl(value) {
  const url = String(value ?? '').trim()
  if (!url) return null
  return /^([a-z][a-z0-9+.-]*:|\/|\?|#)/i.test(url) ? url : `https://${url}`
}

/** The image licence: explicit on the card, else Unsplash for an unsplash.com link, else none. */
export function imageLicense(card) {
  if (card?.license) return card.license
  return /(^|\/\/|\.)unsplash\.com/i.test(card?.linkCopyright ?? '') ? UNSPLASH_LICENSE : null
}

/** The two credit notes of a page card; a missing author or image credit gives null. */
export function creditNotes(card, story, t) {
  const author = story?.author ?? null
  const imgName = card?.copyrightText ?? null
  const note = (text, url) => ({ text, url, policy: policyKindFromHref(url) })
  const storyUrl = normalizeCreditUrl(story?.linkCopyright ?? story?.card?.linkCopyright)
  const imgUrl = normalizeCreditUrl(card?.linkCopyright)
  const imgLic = imageLicense(card)
  return {
    story: author ? note(creditText(t, 'card.storyBy', { name: author })
      + creditText(t, 'card.withLicense', { license: story?.license ?? STORY_LICENSE }), storyUrl) : null,
    image: imgName ? note(creditText(t, 'card.imageBy', { name: imgName })
      + (imgLic ? creditText(t, 'card.withLicense', { license: imgLic }) : ''), imgUrl) : null,
  }
}

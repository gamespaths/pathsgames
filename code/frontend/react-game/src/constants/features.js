/**
 * Feature flags read once at load: a build sets them through Vite env vars, a developer
 * flips the default here. Anything but false/0/no/off keeps the feature on.
 */
export function parseFlag(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase())
}

// v0.35.5 — the bookmarks sticking out of the book's top edge (desktop only).
export const SHOW_BOOK_BOOKMARKS = parseFlag(import.meta.env?.VITE_SHOW_BOOK_BOOKMARKS, true)

// v0.35.5 — the game-status card at the top of the board. Off inside the book, where the
// bookmarks already say what it says; on in the mobile stack, which has no bookmarks (they
// live in .book-wrapper, hidden there) and would otherwise lose that news altogether.
export const SHOW_CARD_CHARACTERISTICS = parseFlag(import.meta.env?.VITE_SHOW_CARD_CHARACTERISTICS, false)
export const SHOW_MOBILE_CARD_CHARACTERISTICS = parseFlag(import.meta.env?.VITE_SHOW_MOBILE_CARD_CHARACTERISTICS, true)

// v0.35.8 — teaser stories from data/stories.json appended to the API catalog on the Home.
export const ADD_COMING_SOON_STORIES = parseFlag(import.meta.env?.VITE_ADD_COMING_SOON_STORIES, false)

// v0.35.8 — Home "Resume" jumps straight into the match instead of opening the guest modal.
export const RESUME_WITHOUT_MODAL = parseFlag(import.meta.env?.VITE_RESUME_WITHOUT_MODAL, false)

// v0.38.1 — drop the stories listed in data/hidden-stories.json from the Home catalog.
export const HIDE_STORIES = parseFlag(import.meta.env?.VITE_HIDE_STORIES, true)

/**
 * The board is rendered TWICE — once inside the book, once in the mobile stack — from one
 * content tree, so a card that shows in one and not in the other cannot be an `if`: both
 * copies would obey it. It is a class the CSS reads under the right ancestor. Null when
 * both sides show it, so the card gets no pointless class.
 */
export function hideWhereClass(showInBook, showInMobile) {
  const classes = []
  if (!showInBook) classes.push('hide-in-book')
  if (!showInMobile) classes.push('hide-in-mobile')
  return classes.length ? classes.join(' ') : null
}

// Step 40 — the story category whose pages open their tip by default (case-insensitive).
export const TUTORIAL_CATEGORY = import.meta.env?.VITE_TUTORIAL_CATEGORY || 'tutorial'

/** True when the story belongs to the tutorial category. */
export function isTutorialStory(story, category = TUTORIAL_CATEGORY) {
  const value = story?.category
  if (!value || !category) return false
  return String(value).trim().toLowerCase() === String(category).trim().toLowerCase()
}

// Step 40 — build-time environment code (dev, test, alpha, beta…) shown as a header badge.
export const ENV_BADGE = import.meta.env?.VITE_ENV_BADGE ?? ''

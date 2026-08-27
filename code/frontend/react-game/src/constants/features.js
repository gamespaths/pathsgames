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

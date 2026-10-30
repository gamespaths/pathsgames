/** v1.7.0 — the translation bundles react-game ships and the names of their languages. */
import en from './en.json'
import it from './it.json'

export const TRANSLATIONS = { en, it }
export const LANGUAGE_LABELS = { en: 'English', it: 'Italiano' }

/** True when react-game has a translation bundle for the language code. */
export function hasBundle(code) {
  return typeof code === 'string' && Object.hasOwn(TRANSLATIONS, code)
}

/** The server languages that also have a bundle; without a usable server list, every bundle. */
export function bundleLanguages(supported) {
  const list = Array.isArray(supported) ? supported.filter(hasBundle) : []
  return list.length > 0 ? [...new Set(list)] : Object.keys(TRANSLATIONS)
}

import { fetchJson } from './client'

export async function getStories(lang) {
  return fetchJson(`/api/stories?lang=${lang ?? 'en'}`)
}

/** v0.37.6 — where the admin export puts the static catalog, on the SITE origin (not the API). */
export function staticCatalogUrl(lang) {
  return `/data/stories-${lang ?? 'en'}.json`
}

/**
 * v0.37.6 — the static catalog file written by POST /api/admin/stories/catalog.
 * Rejects on anything but a JSON array: an S3/CloudFront SPA answers 200 + index.html
 * for a missing path, so `ok` alone would hand the caller an HTML string.
 */
export async function getStoriesStatic(lang) {
  const res = await fetch(staticCatalogUrl(lang), { cache: 'no-cache' })
  if (!res.ok) throw new Error(`static catalog ${res.status}`)
  const type = res.headers?.get?.('content-type') ?? ''
  if (!type.includes('json')) throw new Error('static catalog is not JSON')
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error('static catalog is not a list')
  return data
}

/**
 * v0.37.6 — static file first (no API call), the API only when it is missing or
 * broken. Memoised per language for the page load, so GamePage / the matches list
 * reuse the home's answer instead of refetching the list.
 */
export async function getStoriesCatalog(lang) {
  const l = lang ?? 'en'
  return remember(`list:${l}`, async () => {
    try {
      return await getStoriesStatic(l)
    } catch {
      return getStories(l)
    }
  })
}

/**
 * v0.37.6 — story cache. `memo` holds the in-flight/settled promise per key so two
 * callers in the same tick (StrictMode, modal + page) share ONE request; a rejected
 * one is dropped so the next call retries. Story details are also kept in
 * sessionStorage: they change only on an admin import, so a tab keeps them for
 * its whole session and a later open of the same book costs no request at all.
 */
const SESSION_PREFIX = 'pg_story:'
const memo = new Map()

function readSession(key) {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function writeSession(key, value) {
  try { sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(value)) } catch { /* quota / private mode */ }
}

function remember(key, load, { session = false } = {}) {
  if (memo.has(key)) return memo.get(key)
  const cached = session ? readSession(key) : null
  const promise = cached
    ? Promise.resolve(cached)
    : load()
      .then(data => { if (session) writeSession(key, data); return data })
      .catch(e => { memo.delete(key); throw e })
  memo.set(key, promise)
  return promise
}

/** Forget every cached story (memory + session) — tests, or after an admin import. */
export function clearStoryCache() {
  memo.clear()
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(SESSION_PREFIX))
      .forEach(k => sessionStorage.removeItem(k))
  } catch { /* no sessionStorage */ }
}

/** One story from the catalog list (cached per language for the page load). */
export async function getStory(uuid, lang) {
  const stories = await getStoriesCatalog(lang)
  return stories.find(s => s.uuid === uuid) ?? null
}

/** GET /api/stories/{uuid} — one request per uuid+lang per tab session. */
export async function getStoryDetail(uuid, lang) {
  const l = lang ?? 'en'
  return remember(`detail:${uuid}:${l}`, () => fetchJson(`/api/stories/${uuid}?lang=${l}`), { session: true })
}

/**
 * Step 23 — GET /api/stories/{uuidStory}/classes/{uuidClass}/traits
 * Lists the story traits selectable with the given class
 * (id_class_permitted / id_class_prohibited filter applied by the backend).
 */
export async function getTraitsForClass(storyUuid, classUuid, lang) {
  return fetchJson(
    `/api/stories/${storyUuid}/classes/${classUuid}/traits?lang=${lang ?? 'en'}`,
  )
}

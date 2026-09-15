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

/** v0.37.6 — static file first (no API call), the API only when it is missing or broken. */
export async function getStoriesCatalog(lang) {
  try {
    return await getStoriesStatic(lang)
  } catch {
    return getStories(lang)
  }
}

export async function getStory(uuid, lang) {
  const stories = await getStories(lang)
  return stories.find(s => s.uuid === uuid) ?? null
}

export async function getStoryDetail(uuid, lang) {
  return fetchJson(`/api/stories/${uuid}?lang=${lang ?? 'en'}`)
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

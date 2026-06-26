import { fetchJson } from './client'

export async function getStories(lang) {
  return fetchJson(`/api/stories?lang=${lang ?? 'en'}`)
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

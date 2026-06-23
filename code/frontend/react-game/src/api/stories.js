import { fetchWithFallback } from './client'
import tutorialStoryDoc from '../mock/tutorial_story.json'
import { adaptTutorialStoryList, adaptTutorialStory } from '../mock/tutorialStoryAdapter'

// Mock datasource: tutorial_story.json converted to frontend format
const mockStories = adaptTutorialStoryList(tutorialStoryDoc)

export async function getStories(lang) {
  return fetchWithFallback(`/api/stories?lang=${lang ?? 'en'}`, mockStories)
}

export async function getStory(uuid, lang) {
  const stories = await getStories(lang)
  return stories.find(s => s.uuid === uuid) ?? null
}

export async function getStoryDetail(uuid, lang) {
  const mockDetail = adaptTutorialStory(tutorialStoryDoc)
  return fetchWithFallback(`/api/stories/${uuid}?lang=${lang ?? 'en'}`, mockDetail)
}

/**
 * Step 23 — GET /api/stories/{uuidStory}/classes/{uuidClass}/traits
 * Lists the story traits selectable with the given class
 * (id_class_permitted / id_class_prohibited filter applied by the backend).
 * The mock fallback applies the same filter on the mock story traits.
 */
export async function getTraitsForClass(storyUuid, classUuid, lang) {
  const mockDetail = adaptTutorialStory(tutorialStoryDoc)
  const mockClass = (mockDetail.classes ?? []).find(c => c.uuid === classUuid) ?? null
  const classId = mockClass?.id ?? null
  const mockTraits = (mockDetail.traits ?? []).filter(tr => {
    const permitted = tr.idClassPermitted ?? null
    const prohibited = tr.idClassProhibited ?? null
    const permittedOk = permitted === null || (classId !== null && Number(permitted) === Number(classId))
    const prohibitedOk = prohibited === null || classId === null || Number(prohibited) !== Number(classId)
    return permittedOk && prohibitedOk
  })
  return fetchWithFallback(
    `/api/stories/${storyUuid}/classes/${classUuid}/traits?lang=${lang ?? 'en'}`,
    mockTraits,
  )
}

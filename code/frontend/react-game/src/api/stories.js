import { fetchWithFallback } from './client'
import tutorialStoryDoc from '../mock/tutorial_story.json'
import { adaptTutorialStoryList, adaptTutorialStory } from '../mock/tutorialStoryAdapter'

// Mock datasource: tutorial_story.json converted to frontend format
const mockStories = adaptTutorialStoryList(tutorialStoryDoc)

export async function getStories() {
  return fetchWithFallback('/api/stories', mockStories)
}

export async function getStory(uuid) {
  const stories = await fetchWithFallback('/api/stories', mockStories)
  return stories.find(s => s.uuid === uuid) ?? null
}

export async function getStoryDetail(uuid, lang) {
  const mockDetail = adaptTutorialStory(tutorialStoryDoc)
  return fetchWithFallback(`/api/stories/${uuid}?lang=${lang ?? 'en'}`, mockDetail)
}

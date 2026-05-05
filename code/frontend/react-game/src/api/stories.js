import { fetchWithFallback } from './client'
import mockStories from '../mock/stories.json'

export async function getStories() {
  return fetchWithFallback('/api/stories', mockStories)
}

export async function getStory(uuid) {
  const stories = await fetchWithFallback('/api/stories', mockStories)
  return stories.find(s => s.uuid === uuid) ?? null
}

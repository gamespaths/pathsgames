import { fetchWithFallback } from './client'
import mockGameData from '../mock/gameData.json'

export async function getGameData(storyId) {
  return fetchWithFallback(`/api/games/${storyId}/state`, mockGameData)
}

export async function getLocations(storyId) {
  const data = await fetchWithFallback(`/api/stories/${storyId}/locations`, mockGameData)
  return data.locations ?? mockGameData.locations
}

export async function getActions(locationId) {
  const data = await fetchWithFallback(`/api/gameplay/${locationId}/actions`, mockGameData)
  return data.actions ?? mockGameData.actions
}

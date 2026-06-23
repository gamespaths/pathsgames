import { describe, it, expect, vi, beforeEach } from 'vitest'

// Make fetchWithFallback behave like mock mode: always return the mock data
// argument, so the find/filter logic inside stories.js is exercised.
vi.mock('../api/client', () => ({
  fetchWithFallback: vi.fn((url, mockData) => Promise.resolve(mockData)),
}))

import { fetchWithFallback } from '../api/client'
import { getStories, getStory, getStoryDetail, getTraitsForClass } from '../api/stories'

describe('api/stories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getStories returns the adapted mock list', async () => {
    const list = await getStories()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].uuid).toBeTruthy()
  })

  it('getStories forwards the requested lang and defaults to en', async () => {
    await getStories('it')
    expect(fetchWithFallback).toHaveBeenCalledWith('/api/stories?lang=it', expect.anything())
    await getStories()
    expect(fetchWithFallback).toHaveBeenCalledWith('/api/stories?lang=en', expect.anything())
  })

  it('getStory forwards lang to the list endpoint', async () => {
    const known = (await getStories())[0].uuid
    await getStory(known, 'it')
    expect(fetchWithFallback).toHaveBeenCalledWith('/api/stories?lang=it', expect.anything())
  })

  it('getStory finds a story by uuid and returns null when unknown', async () => {
    const list = await getStories()
    const known = list[0].uuid
    expect((await getStory(known)).uuid).toBe(known)
    expect(await getStory('does-not-exist')).toBeNull()
  })

  it('getStoryDetail fetches the detail endpoint with the lang query', async () => {
    const known = (await getStories())[0].uuid
    const detail = await getStoryDetail(known, 'it')
    expect(detail).toBeTruthy()
    expect(fetchWithFallback).toHaveBeenCalledWith(
      `/api/stories/${known}?lang=it`,
      expect.anything(),
    )
  })

  it('getStoryDetail defaults the lang to en', async () => {
    await getStoryDetail('s1')
    expect(fetchWithFallback).toHaveBeenCalledWith('/api/stories/s1?lang=en', expect.anything())
  })

  it('getTraitsForClass filters traits by class and builds the endpoint url', async () => {
    const detail = await getStoryDetail('s1')
    const aClass = (detail.classes ?? [])[0]
    const traits = await getTraitsForClass('s1', aClass?.uuid, 'en')
    expect(Array.isArray(traits)).toBe(true)
    expect(fetchWithFallback).toHaveBeenCalledWith(
      expect.stringContaining(`/api/stories/s1/classes/${aClass?.uuid}/traits?lang=en`),
      expect.anything(),
    )
  })

  it('getTraitsForClass tolerates an unknown class uuid', async () => {
    const traits = await getTraitsForClass('s1', 'unknown-class')
    expect(Array.isArray(traits)).toBe(true)
  })
})

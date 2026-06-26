import { describe, it, expect, vi, beforeEach } from 'vitest'

// fetchJson is mocked so the URL building and post-processing in stories.js are
// exercised without hitting the network. Each test stubs the resolved payload.
vi.mock('../api/client', () => ({
  fetchJson: vi.fn(() => Promise.resolve([])),
}))

import { fetchJson } from '../api/client'
import { getStories, getStory, getStoryDetail, getTraitsForClass } from '../api/stories'

describe('api/stories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getStories returns the backend list', async () => {
    fetchJson.mockResolvedValueOnce([{ uuid: 's1' }, { uuid: 's2' }])
    const list = await getStories()
    expect(list).toEqual([{ uuid: 's1' }, { uuid: 's2' }])
  })

  it('getStories forwards the requested lang and defaults to en', async () => {
    await getStories('it')
    expect(fetchJson).toHaveBeenCalledWith('/api/stories?lang=it')
    await getStories()
    expect(fetchJson).toHaveBeenCalledWith('/api/stories?lang=en')
  })

  it('getStory forwards lang to the list endpoint', async () => {
    fetchJson.mockResolvedValueOnce([{ uuid: 's1' }])
    await getStory('s1', 'it')
    expect(fetchJson).toHaveBeenCalledWith('/api/stories?lang=it')
  })

  it('getStory finds a story by uuid and returns null when unknown', async () => {
    fetchJson.mockResolvedValue([{ uuid: 's1' }, { uuid: 's2' }])
    expect((await getStory('s1')).uuid).toBe('s1')
    expect(await getStory('does-not-exist')).toBeNull()
  })

  it('getStoryDetail fetches the detail endpoint with the lang query', async () => {
    fetchJson.mockResolvedValueOnce({ uuid: 's1' })
    const detail = await getStoryDetail('s1', 'it')
    expect(detail).toEqual({ uuid: 's1' })
    expect(fetchJson).toHaveBeenCalledWith('/api/stories/s1?lang=it')
  })

  it('getStoryDetail defaults the lang to en', async () => {
    await getStoryDetail('s1')
    expect(fetchJson).toHaveBeenCalledWith('/api/stories/s1?lang=en')
  })

  it('getTraitsForClass builds the endpoint url and returns the list', async () => {
    fetchJson.mockResolvedValueOnce([{ uuid: 't1' }])
    const traits = await getTraitsForClass('s1', 'c1', 'en')
    expect(traits).toEqual([{ uuid: 't1' }])
    expect(fetchJson).toHaveBeenCalledWith('/api/stories/s1/classes/c1/traits?lang=en')
  })

  it('getTraitsForClass defaults the lang to en', async () => {
    await getTraitsForClass('s1', 'c1')
    expect(fetchJson).toHaveBeenCalledWith('/api/stories/s1/classes/c1/traits?lang=en')
  })
})

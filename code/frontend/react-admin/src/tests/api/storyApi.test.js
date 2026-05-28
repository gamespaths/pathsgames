import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../../api/client'
import * as storyApi from '../../api/storyApi'

vi.mock('../../api/client', () => ({
  apiClient: vi.fn()
}))

describe('storyApi', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockPut = vi.fn()
  const mockDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete
    })
  })

  it('listAllStories calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: ['story1', 'story2'] })
    const res = await storyApi.listAllStories('it')
    expect(mockGet).toHaveBeenCalledWith('/api/admin/stories', { params: { lang: 'it' } })
    expect(res).toEqual(['story1', 'story2'])
  })

  it('createStory calls correct endpoint', async () => {
    mockPost.mockResolvedValue({ data: { uuid: 'new' } })
    const res = await storyApi.createStory({ title: 'New' })
    expect(mockPost).toHaveBeenCalledWith('/api/admin/stories', { title: 'New' })
    expect(res).toEqual({ uuid: 'new' })
  })

  it('updateStory calls correct endpoint', async () => {
    mockPut.mockResolvedValue({ data: { status: 'ok' } })
    const res = await storyApi.updateStory('123', { title: 'Updated' })
    expect(mockPut).toHaveBeenCalledWith('/api/admin/stories/123', { title: 'Updated' })
    expect(res).toEqual({ status: 'ok' })
  })

  it('getStory calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: { uuid: '123' } })
    const res = await storyApi.getStory('123')
    expect(mockGet).toHaveBeenCalledWith('/api/admin/stories/123')
    expect(res).toEqual({ uuid: '123' })
  })

  it('importStory calls correct endpoint', async () => {
    mockPost.mockResolvedValue({ data: { status: 'imported' } })
    const res = await storyApi.importStory({ json: 'data' })
    expect(mockPost).toHaveBeenCalledWith('/api/admin/stories/import', { json: 'data' })
    expect(res).toEqual({ status: 'imported' })
  })

  it('deleteStory calls correct endpoint', async () => {
    mockDelete.mockResolvedValue({ data: { status: 'deleted' } })
    const res = await storyApi.deleteStory('123')
    expect(mockDelete).toHaveBeenCalledWith('/api/admin/stories/123')
    expect(res).toEqual({ status: 'deleted' })
  })

  it('listEntities calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: [] })
    const res = await storyApi.listEntities('s1', 'locations')
    expect(mockGet).toHaveBeenCalledWith('/api/admin/stories/s1/locations')
    expect(res).toEqual([])
  })

  it('createEntity calls correct endpoint', async () => {
    mockPost.mockResolvedValue({ data: { uuid: 'e1' } })
    const res = await storyApi.createEntity('s1', 'locations', { name: 'Loc' })
    expect(mockPost).toHaveBeenCalledWith('/api/admin/stories/s1/locations', { name: 'Loc' })
    expect(res).toEqual({ uuid: 'e1' })
  })

  it('getEntity calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: { uuid: 'e1' } })
    const res = await storyApi.getEntity('s1', 'locations', 'e1')
    expect(mockGet).toHaveBeenCalledWith('/api/admin/stories/s1/locations/e1')
    expect(res).toEqual({ uuid: 'e1' })
  })

  it('updateEntity calls correct endpoint', async () => {
    mockPut.mockResolvedValue({ data: { status: 'updated' } })
    const res = await storyApi.updateEntity('s1', 'locations', 'e1', { name: 'New' })
    expect(mockPut).toHaveBeenCalledWith('/api/admin/stories/s1/locations/e1', { name: 'New' })
    expect(res).toEqual({ status: 'updated' })
  })

  it('deleteEntity calls correct endpoint', async () => {
    mockDelete.mockResolvedValue({ data: { status: 'deleted' } })
    const res = await storyApi.deleteEntity('s1', 'locations', 'e1')
    expect(mockDelete).toHaveBeenCalledWith('/api/admin/stories/s1/locations/e1')
    expect(res).toEqual({ status: 'deleted' })
  })

  it('listPublicStories calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: [] })
    const res = await storyApi.listPublicStories('en')
    expect(mockGet).toHaveBeenCalledWith('/api/stories', { params: { lang: 'en' } })
    expect(res).toEqual([])
  })
})

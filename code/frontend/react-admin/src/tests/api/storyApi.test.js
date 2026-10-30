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

  it('listAllStories reads a plain array (backend before 1.7.0) as one page', async () => {
    mockGet.mockResolvedValue({ data: ['story1', 'story2'] })
    const res = await storyApi.listAllStories('it')
    expect(mockGet).toHaveBeenCalledWith('/api/admin/stories', { params: { lang: 'it', limit: 200 } })
    expect(res).toEqual(['story1', 'story2'])
  })

  it('v1.7.0 listAllStories follows nextCursor through every page', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { items: ['s1', 's2'], nextCursor: '2', limit: 200 } })
      .mockResolvedValueOnce({ data: { items: ['s3'], nextCursor: null, limit: 200 } })
    expect(await storyApi.listAllStories()).toEqual(['s1', 's2', 's3'])
    expect(mockGet).toHaveBeenNthCalledWith(2, '/api/admin/stories', { params: { lang: 'en', limit: 200, cursor: '2' } })
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: { nextCursor: 'again' } })
    expect(await storyApi.listAllStories('en')).toEqual([])
    expect(mockGet).toHaveBeenCalledTimes(50)
  })

  it('v1.7.0 listStoriesPage sends only the given paging params', async () => {
    mockGet.mockResolvedValue({ data: { items: [], nextCursor: null, limit: 10 } })
    await storyApi.listStoriesPage()
    expect(mockGet).toHaveBeenLastCalledWith('/api/admin/stories', { params: { lang: 'en' } })
    await storyApi.listStoriesPage('it', { limit: 10, cursor: '20' })
    expect(mockGet).toHaveBeenLastCalledWith('/api/admin/stories', { params: { lang: 'it', limit: 10, cursor: '20' } })
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

  it('writeStaticCatalog posts to the catalog endpoint (v0.37.6)', async () => {
    mockPost.mockResolvedValue({ data: { status: 'WRITTEN', target: 's3://b', files: [] } })
    const res = await storyApi.writeStaticCatalog()
    expect(mockPost).toHaveBeenCalledWith('/api/admin/stories/catalog')
    expect(res.status).toBe('WRITTEN')
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

  it('validateStory calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: { valid: true } })
    const res = await storyApi.validateStory('s1')
    expect(mockGet).toHaveBeenCalledWith('/api/admin/stories/s1/validate')
    expect(res).toEqual({ valid: true })
  })

  it('getStory throws when uuid contains unsafe segment characters', () => {
    expect(() => storyApi.getStory('s1/../etc')).toThrow('Invalid URL path segment')
  })
})

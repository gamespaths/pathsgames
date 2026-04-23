import { apiClient } from './client'

// GET /api/admin/stories
export const listAllStories = (lang = 'en') =>
  apiClient().get('/api/admin/stories', { params: { lang } }).then(r => r.data)

// POST /api/admin/stories/import
export const importStory = (storyJson) =>
  apiClient().post('/api/admin/stories/import', storyJson).then(r => r.data)

// DELETE /api/admin/stories/:uuid
export const deleteStory = (uuid) =>
  apiClient().delete(`/api/admin/stories/${uuid}`).then(r => r.data)

// GET /api/stories  (public, for dashboard)
export const listPublicStories = (lang = 'en') =>
  apiClient().get('/api/stories', { params: { lang } }).then(r => r.data)

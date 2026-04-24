import { apiClient } from './client'

// GET /api/admin/stories
export const listAllStories = (lang = 'en') =>
  apiClient().get('/api/admin/stories', { params: { lang } }).then(r => r.data)

// POST /api/admin/stories
export const createStory = (data) =>
  apiClient().post('/api/admin/stories', data).then(r => r.data)

// PUT /api/admin/stories/:uuidStory
export const updateStory = (uuid, data) =>
  apiClient().put(`/api/admin/stories/${uuid}`, data).then(r => r.data)

export const getStory = (uuid) =>
  apiClient().get(`/api/admin/stories/${uuid}`).then(r => r.data)

// POST /api/admin/stories/import
export const importStory = (storyJson) =>
  apiClient().post('/api/admin/stories/import', storyJson).then(r => r.data)

// DELETE /api/admin/stories/:uuid
export const deleteStory = (uuid) =>
  apiClient().delete(`/api/admin/stories/${uuid}`).then(r => r.data)

// --- Sub-entity CRUD ---

// GET /api/admin/stories/:uuidStory/:entityType
export const listEntities = (uuidStory, entityType) =>
  apiClient().get(`/api/admin/stories/${uuidStory}/${entityType}`).then(r => r.data)

// POST /api/admin/stories/:uuidStory/:entityType
export const createEntity = (uuidStory, entityType, data) =>
  apiClient().post(`/api/admin/stories/${uuidStory}/${entityType}`, data).then(r => r.data)

// GET /api/admin/stories/:uuidStory/:entityType/:entityUuid
export const getEntity = (uuidStory, entityType, entityUuid) =>
  apiClient().get(`/api/admin/stories/${uuidStory}/${entityType}/${entityUuid}`).then(r => r.data)

// PUT /api/admin/stories/:uuidStory/:entityType/:entityUuid
export const updateEntity = (uuidStory, entityType, entityUuid, data) =>
  apiClient().put(`/api/admin/stories/${uuidStory}/${entityType}/${entityUuid}`, data).then(r => r.data)

// DELETE /api/admin/stories/:uuidStory/:entityType/:entityUuid
export const deleteEntity = (uuidStory, entityType, entityUuid) =>
  apiClient().delete(`/api/admin/stories/${uuidStory}/${entityType}/${entityUuid}`).then(r => r.data)

// GET /api/stories  (public, for dashboard)
export const listPublicStories = (lang = 'en') =>
  apiClient().get('/api/stories', { params: { lang } }).then(r => r.data)

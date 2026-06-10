import { apiClient } from './client'

// Story uuids and entity-type slugs only ever contain url-safe identifier
// characters. Validate every path segment against this allow-list before it is
// interpolated into a request URL, so tainted data (e.g. a uuid read from an
// API response) cannot alter the request target (SonarQube S5146 / S5144).
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/

function seg(value) {
  const s = String(value)
  if (!SAFE_SEGMENT.test(s)) {
    throw new Error(`Invalid URL path segment: "${s}"`)
  }
  return encodeURIComponent(s)
}

// GET /api/admin/stories
export const listAllStories = (lang = 'en') =>
  apiClient().get('/api/admin/stories', { params: { lang } }).then(r => r.data)

// POST /api/admin/stories
export const createStory = (data) =>
  apiClient().post('/api/admin/stories', data).then(r => r.data)

// PUT /api/admin/stories/:uuidStory
export const updateStory = (uuid, data) =>
  apiClient().put(`/api/admin/stories/${seg(uuid)}`, data).then(r => r.data)

export const getStory = (uuid) =>
  apiClient().get(`/api/admin/stories/${seg(uuid)}`).then(r => r.data)

// POST /api/admin/stories/import
export const importStory = (storyJson) =>
  apiClient().post('/api/admin/stories/import', storyJson).then(r => r.data)

// DELETE /api/admin/stories/:uuid
export const deleteStory = (uuid) =>
  apiClient().delete(`/api/admin/stories/${seg(uuid)}`).then(r => r.data)

// GET /api/admin/stories/:uuid/validate — Step 22 integrity report
export const validateStory = (uuid) =>
  apiClient().get(`/api/admin/stories/${seg(uuid)}/validate`).then(r => r.data)

// --- Sub-entity CRUD ---

// GET /api/admin/stories/:uuidStory/:entityType
export const listEntities = (uuidStory, entityType) =>
  apiClient().get(`/api/admin/stories/${seg(uuidStory)}/${seg(entityType)}`).then(r => r.data)

// POST /api/admin/stories/:uuidStory/:entityType
export const createEntity = (uuidStory, entityType, data) =>
  apiClient().post(`/api/admin/stories/${seg(uuidStory)}/${seg(entityType)}`, data).then(r => r.data)

// GET /api/admin/stories/:uuidStory/:entityType/:entityUuid
export const getEntity = (uuidStory, entityType, entityUuid) =>
  apiClient().get(`/api/admin/stories/${seg(uuidStory)}/${seg(entityType)}/${seg(entityUuid)}`).then(r => r.data)

// PUT /api/admin/stories/:uuidStory/:entityType/:entityUuid
export const updateEntity = (uuidStory, entityType, entityUuid, data) =>
  console.log('Updating entity', { uuidStory, entityType, entityUuid, data }) ||
  apiClient().put(`/api/admin/stories/${seg(uuidStory)}/${seg(entityType)}/${seg(entityUuid)}`, data).then(r => r.data)

// DELETE /api/admin/stories/:uuidStory/:entityType/:entityUuid
export const deleteEntity = (uuidStory, entityType, entityUuid) =>
  apiClient().delete(`/api/admin/stories/${seg(uuidStory)}/${seg(entityType)}/${seg(entityUuid)}`).then(r => r.data)

// GET /api/stories  (public, for dashboard)
export const listPublicStories = (lang = 'en') =>
  apiClient().get('/api/stories', { params: { lang } }).then(r => r.data)

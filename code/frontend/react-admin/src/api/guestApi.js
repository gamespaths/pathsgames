import { apiClient } from './client'

// GET /api/admin/guests — v0.36.2, paginated. Returns the envelope
// { items, nextCursor, limit }; `params` may carry { limit, cursor, olderThanDays }.
// It used to return every guest at once, which timed out against AWS.
export const listGuests = (params = {}) =>
  apiClient().get('/api/admin/guests', { params }).then(r => r.data)

// GET /api/admin/guests/stats
export const getGuestStats = () =>
  apiClient().get('/api/admin/guests/stats').then(r => r.data)

// GET /api/admin/guests/:uuid
export const getGuest = (uuid) =>
  apiClient().get(`/api/admin/guests/${uuid}`).then(r => r.data)

// DELETE /api/admin/guests/:uuid
export const deleteGuest = (uuid) =>
  apiClient().delete(`/api/admin/guests/${uuid}`).then(r => r.data)

// DELETE /api/admin/guests/expired
export const deleteExpiredGuests = () =>
  apiClient().delete('/api/admin/guests/expired').then(r => r.data)

// GET /api/admin/guests/stale?olderThanDays=N — the dry run: how many guests,
// and how many of their matches, the purge below would take. { guests, matches }
export const previewStaleGuests = (olderThanDays) =>
  apiClient().get('/api/admin/guests/stale', { params: { olderThanDays } }).then(r => r.data)

// DELETE /api/admin/guests/stale?olderThanDays=N — remove every guest not seen
// for N days AND every match they created, whatever its status.
export const deleteStaleGuests = (olderThanDays) =>
  apiClient().delete('/api/admin/guests/stale', { params: { olderThanDays } }).then(r => r.data)

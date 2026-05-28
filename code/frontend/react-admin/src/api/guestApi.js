import { apiClient } from './client'

// GET /api/admin/guests
export const listGuests = () =>
  apiClient().get('/api/admin/guests').then(r => r.data)

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

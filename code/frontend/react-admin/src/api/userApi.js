import { apiClient } from './client'

// v0.41.6 — GET /api/admin/users/:identifier — one user by uuid, email or username (the owner-move
// preview): the AdminUserResponse with eligible/reason; 404 USER_NOT_FOUND, 409 USER_AMBIGUOUS.
export const getAdminUser = (identifier) =>
  apiClient().get(`/api/admin/users/${encodeURIComponent(String(identifier ?? '').trim())}`).then(r => r.data)

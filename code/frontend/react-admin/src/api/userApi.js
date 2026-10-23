import { apiClient } from './client'

// v0.41.6 — GET /api/admin/users/:identifier — one user by uuid, email or username (the owner-move
// preview): the AdminUserResponse with eligible/reason; 404 USER_NOT_FOUND, 409 USER_AMBIGUOUS.
// v1.7.0 it also carries the detail: accountType, suspendedUntil, relinkPending, banned, sessions, stats, identities.
export const getAdminUser = (identifier) =>
  apiClient().get(`/api/admin/users/${encodeURIComponent(String(identifier ?? '').trim())}`).then(r => r.data)

// v1.7.0 — GET /api/admin/users — the envelope { items, nextCursor, limit }; empty filters are not sent.
export const listAdminUsers = ({ limit, cursor, email, nickname, state } = {}) => {
  const params = {}
  Object.entries({ limit, cursor, email, nickname, state }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') params[key] = value
  })
  return apiClient().get('/api/admin/users', { params }).then(r => r.data)
}

// v1.7.0 — POST /api/admin/users/:uuid/<action> { reason[, until] } — the AdminUserActionResult.
const userAction = (uuid, action, body) =>
  apiClient().post(`/api/admin/users/${encodeURIComponent(String(uuid ?? '').trim())}/${action}`, body)
    .then(r => r.data)

export const banUser = (uuid, reason) => userAction(uuid, 'ban', { reason })

export const suspendUser = (uuid, until, reason) => userAction(uuid, 'suspend', { until, reason })

export const unblockUser = (uuid, reason) => userAction(uuid, 'unblock', { reason })

export const relinkSubject = (uuid, reason) => userAction(uuid, 'relink-subject', { reason })

// "Delete the old user" of an IDENTITY_MISMATCH: state 7 and the normal deletion job.
export const deleteOldUser = (uuid, reason) => userAction(uuid, 'deletion', { reason })

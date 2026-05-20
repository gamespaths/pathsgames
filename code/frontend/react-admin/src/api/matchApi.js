import { apiClient } from './client'

/**
 * Match API client (Step 19 / v0.19.10).
 *
 * The admin console lists every match via the admin-only endpoint
 * `GET /api/admin/matches` (not the per-user `GET /api/matches`), so it shows
 * matches created by all players — see openapi/v0.19.0-match-creation-api.yaml.
 * Requests carry the admin bearer token configured on the login screen.
 */

// GET /api/admin/matches — every match in the platform (admin view, newest first)
export const listMatches = () =>
  apiClient().get('/api/admin/matches').then(r => r.data)

// GET /api/match/:uuid/info — full runtime state of a single match
export const getMatchInfo = (uuid) =>
  apiClient().get(`/api/match/${uuid}/info`).then(r => r.data)

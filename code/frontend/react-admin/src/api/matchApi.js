import { apiClient } from './client'

/**
 * Match API client (Step 19 / v0.19.10, admin match control added later).
 *
 * The admin console lists every match via the admin-only endpoint
 * `GET /api/admin/matches` (not the per-user `GET /api/matches`), so it shows
 * matches created by all players — see openapi/v0.19.0-match-creation-api.yaml.
 * Requests carry the admin bearer token configured on the login screen.
 */

// GET /api/admin/matches — every match in the platform (admin view, newest first)
export const listMatches = () =>
  apiClient().get('/api/admin/matches').then(r => r.data)

// GET /api/admin/matches/:uuid/info — full runtime state of a single match.
// The admin console uses the admin-scoped endpoint (not the per-user
// /api/match/:uuid/info) so it can inspect matches created by any player.
export const getMatchInfo = (uuid) =>
  apiClient().get(`/api/admin/matches/${uuid}/info`).then(r => r.data)

// GET /api/admin/matches/:uuid/clock — clock cycle state (Step 26): current
// clock, story labels and per-character sleeping/energy. Admin-scoped mirror of
// the player endpoint GET /api/match/:uuid/clock, without the ownership check.
export const getMatchClock = (uuid) =>
  apiClient().get(`/api/admin/matches/${uuid}/clock`).then(r => r.data)

// GET /api/admin/matches/:uuid/weather — weather view (Step 27): the per-match
// rngSeed, the current weather (delta_energy + movement-cost modifiers) and the
// full log_weather history ordered by clock.
export const getMatchWeather = (uuid) =>
  apiClient().get(`/api/admin/matches/${uuid}/weather`).then(r => r.data)

// GET /api/admin/matches/statuses — valid match statuses [{ value, terminal }]
export const listMatchStatuses = () =>
  apiClient().get('/api/admin/matches/statuses').then(r => r.data)

// PUT /api/admin/matches/:uuid — update a match's status and/or name
export const updateMatch = (uuid, body) =>
  apiClient().put(`/api/admin/matches/${uuid}`, body).then(r => r.data)

// POST /api/admin/matches/:uuid/stop — set the match status to ENDED
export const stopMatch = (uuid) =>
  apiClient().post(`/api/admin/matches/${uuid}/stop`).then(r => r.data)

// POST /api/admin/matches/:uuid/pause — set the match status to PAUSED
export const pauseMatch = (uuid) =>
  apiClient().post(`/api/admin/matches/${uuid}/pause`).then(r => r.data)

// POST /api/admin/matches/:uuid/resume — set the match status to RUNNING
export const resumeMatch = (uuid) =>
  apiClient().post(`/api/admin/matches/${uuid}/resume`).then(r => r.data)

// DELETE /api/admin/matches/:uuid — delete a stopped match (ENDED / GAMEOVER)
export const deleteMatch = (uuid) =>
  apiClient().delete(`/api/admin/matches/${uuid}`).then(r => r.data)

// POST /api/admin/matches/:uuid/player/:playerUuid/changeStatistics
// Override character statistics. Pass -1 to leave a field unchanged.
export const changePlayerStatistics = (matchUuid, playerUuid, body) =>
  apiClient().post(`/api/admin/matches/${matchUuid}/player/${playerUuid}/changeStatistics`, body).then(r => r.data)

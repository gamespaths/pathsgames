import { apiClient } from './client'

/**
 * Single-player match API client (Step 19 / v0.19.10).
 *
 * Endpoints (see openapi/v0.19.0-match-creation-api.yaml):
 *   POST /api/matches               — create a match for the current user
 *   GET  /api/matches               — list the current user's matches
 *   GET  /api/match/{uuid}/info     — runtime state of a single match
 *
 * All endpoints are protected by the JWT bearer token issued by the guest
 * authentication flow. When the app runs against the mock server (`apiClient()`
 * returns `null`) there is no backend, so `createMatch` synthesizes a plausible
 * `MatchSummary` and the read endpoints return empty results.
 */

/** Build a fresh uuid for an offline (mock-server) match. */
function mockUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'mock-' + Date.now().toString(36)
}

/** Synthesize a MatchSummary mirroring what the backend would return. */
function mockMatch(payload) {
  return {
    uuid: mockUuid(),
    storyUuid: payload?.storyUuid ?? null,
    difficultyUuid: payload?.difficultyUuid ?? null,
    name: payload?.name ?? null,
    status: 'CREATED',
    currentClock: 0,
    expCost: 0,
    tsInsert: new Date().toISOString(),
    singlePlayer: payload?.singlePlayer ?? 1,
    characterTemplateUuid: payload?.characterTemplateUuid ?? null,
    classUuid: payload?.classUuid ?? null,
    traitUuids: payload?.traitUuids ?? [],
  }
}

/** Axios request config carrying the bearer token (when available). */
function authConfig(accessToken) {
  return accessToken
    ? { headers: { Authorization: `Bearer ${accessToken}` }, withCredentials: true }
    : { withCredentials: true }
}

/**
 * Create a single-player match. Throws on a backend error so the caller can
 * surface it; only the mock server short-circuits to a synthesized summary.
 */
export async function createMatch(payload, accessToken) {
  const client = apiClient()
  if (!client) return mockMatch(payload)
  const res = await client.post('/api/matches', payload, authConfig(accessToken))
  return res.data
}

/** List the matches owned by the authenticated user (newest first). */
export async function listMatches(accessToken) {
  const client = apiClient()
  if (!client) return []
  const res = await client.get('/api/matches', authConfig(accessToken))
  return res.data
}

/** Retrieve the full runtime info of one match owned by the current user. */
export async function getMatchInfo(uuid, accessToken) {
  const client = apiClient()
  if (!client) return null
  const res = await client.get(`/api/match/${uuid}/info`, authConfig(accessToken))
  return res.data
}

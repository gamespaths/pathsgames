import { apiClient } from './client'

/**
 * Single-player match API client (Step 19 / v0.19.10, Step 20 / v0.20.1).
 *
 * Endpoints (see openapi/v0.19.0-match-creation-api.yaml +
 * openapi/v0.20.1-match-end-api.yaml):
 *   POST  /api/matches                              — create a match for the current user
 *   GET   /api/matches                              — list the current user's matches
 *   GET   /api/match/{uuid}/info                    — runtime state of a single match
 *   PATCH /api/match/{uuidMatch}/end/{uuidEvent}    — player-driven completion
 *
 * All endpoints are protected by the JWT bearer token issued by the guest
 * authentication flow.
 */

/** Axios request config carrying the bearer token (when available). */
function authConfig(accessToken) {
  return accessToken
    ? { headers: { Authorization: `Bearer ${accessToken}` }, withCredentials: true }
    : { withCredentials: true }
}

/**
 * Create a single-player match. Throws on a backend error so the caller can
 * surface it.
 */
export async function createMatch(payload, accessToken) {
  const res = await apiClient().post('/api/matches', payload, authConfig(accessToken))
  return res.data
}

/** List the matches owned by the authenticated user (newest first). */
export async function listMatches(accessToken) {
  const res = await apiClient().get('/api/matches', authConfig(accessToken))
  return res.data
}

/** Retrieve the full runtime info of one match owned by the current user. */
export async function getMatchInfo(uuid, accessToken, lang) {
  const res = await apiClient().get(`/api/match/${uuid}/info?lang=${lang ?? 'en'}`, authConfig(accessToken))
  return res.data
}

/**
 * Complete a match by triggering the configured end-game event.
 * The backend resolves `uuidEvent` against the match's story and only succeeds
 * (200, `{ status: 'ENDED', uuid }`) when it matches the story's
 * `idEventEndGame`. Returns `406` when the event is not the end-game event
 * (`EVENT_NOT_END_GAME`) and `404` when the caller does not own the match.
 */
export async function endMatch(uuidMatch, uuidEvent, accessToken) {
  const res = await apiClient().patch(
    `/api/match/${uuidMatch}/end/${uuidEvent}`,
    null,
    authConfig(accessToken),
  )
  return res.data
}

/**
 * Step 21 — join a match: instantiate the caller's character. The optional
 * `payload` carries the loadout (characterTemplateUuid / classUuid / traitUuids);
 * when omitted the backend falls back to the loadout stored on the match.
 * Throws on a backend error.
 */
export async function joinMatch(uuidMatch, payload, accessToken) {
  const res = await apiClient().post(
    `/api/matches/${uuidMatch}/join`,
    payload ?? {},
    authConfig(accessToken),
  )
  return res.data
}

/** List the characters present in a match. */
export async function getMatchPlayers(uuidMatch, accessToken) {
  const res = await apiClient().get(`/api/match/${uuidMatch}/players`, authConfig(accessToken))
  return res.data
}

/** Retrieve a single character's full detail within a match. */
export async function getCharacter(uuidMatch, uuidCharacter, accessToken) {
  const res = await apiClient().get(
    `/api/match/${uuidMatch}/characters/${uuidCharacter}`,
    authConfig(accessToken),
  )
  return res.data
}

/* ── Step 24 — single-player turn cycle ───────────────────────────────────── */

/**
 * Start a match: CREATED → RUNNING, build the turn queue and activate the first
 * turn. Returns the resulting turn sequence. Throws on a backend error
 * (409 MATCH_NOT_STARTABLE / NO_CHARACTERS_JOINED, 404 MATCH_NOT_FOUND).
 */
export async function startMatch(uuidMatch, accessToken) {
  const res = await apiClient().post(
    `/api/matches/${uuidMatch}/start`,
    null,
    authConfig(accessToken),
  )
  return res.data
}

/**
 * Pass the active character's turn (no energy cost). Completes the current turn
 * and activates the next character. Throws on a backend error
 * (409 MATCH_NOT_RUNNING / NOT_YOUR_TURN, 404 MATCH_NOT_FOUND).
 */
export async function passTurn(uuidMatch, accessToken) {
  const res = await apiClient().post(
    `/api/gameplay/${uuidMatch}/action/pass`,
    null,
    authConfig(accessToken),
  )
  return res.data
}

/** Read the current turn queue with statuses for a match owned by the caller. */
export async function getTurnSequence(uuidMatch, accessToken) {
  const res = await apiClient().get(
    `/api/match/${uuidMatch}/turn-sequence`,
    authConfig(accessToken),
  )
  return res.data
}

/* ── Step 25/26 — time advancement & clock cycle ──────────────────────────── */

/**
 * Read the current clock, story labels and per-character sleeping/energy state.
 * Any participant in the match may call this. Throws on a backend error
 * (404 MATCH_NOT_FOUND).
 */
export async function getMatchClock(uuidMatch, accessToken) {
  const res = await apiClient().get(
    `/api/match/${uuidMatch}/clock`,
    authConfig(accessToken),
  )
  return res.data
}

/**
 * Step 27 — read the current weather of a match (GET /api/matches/{uuid}/weather).
 * Returns the weather payload, or null when none is set yet (the backend answers
 * 404 WEATHER_NOT_FOUND, which we map to null so callers can render nothing).
 */
export async function getMatchWeather(uuidMatch, accessToken) {
  try {
    const res = await apiClient().get(
      `/api/matches/${uuidMatch}/weather`,
      authConfig(accessToken),
    )
    return res.data
  } catch (e) {
    if (e?.response?.status === 404) return null
    throw e
  }
}

/**
 * Set the caller's character to sleep, then evaluate the time-end trigger; when
 * every character is sleeping or out of energy the backend advances the clock
 * (`timeEndTriggered = true`). Throws on a backend error (409 ALREADY_SLEEPING /
 * NOT_YOUR_TURN / MATCH_NOT_RUNNING, 404 MATCH_NOT_FOUND).
 */
export async function sleepCharacter(uuidMatch, accessToken) {
  const res = await apiClient().post(
    `/api/gameplay/${uuidMatch}/action/sleep`,
    null,
    authConfig(accessToken),
  )
  return res.data
}

/* ── Step 28 — movement system ────────────────────────────────────────────── */

/**
 * Move the caller's active character to an adjacent location identified by its
 * location uuid. The backend deducts the combined energy cost (edge + entry +
 * weather) and returns the new position/energy. Throws on a backend error
 * (409 NOT_A_NEIGHBOR / INSUFFICIENT_ENERGY / LOCATION_FULL / …, 404
 * MATCH_NOT_FOUND).
 */
export async function startMovement(uuidMatch, targetLocationUuid, accessToken) {
  const res = await apiClient().post(
    `/api/gameplay/${uuidMatch}/movements/start`,
    { targetLocationUuid },
    authConfig(accessToken),
  )
  return res.data
}

/**
 * Step 28 — read the visited locations of a match, each with its character count
 * and the per-neighbor `totalEnergyCost` resolved for the current weather (the
 * neighbor list itself comes from /info; this endpoint carries the resolved
 * cost). Returns `{ matchUuid, locations: [] }`.
 */
export async function getMatchLocations(uuidMatch, accessToken) {
  const res = await apiClient().get(
    `/api/match/${uuidMatch}/locations`,
    authConfig(accessToken),
  )
  return res.data
}

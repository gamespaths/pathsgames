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
 * authentication flow. When the app runs against the mock server (`apiClient()`
 * returns `null`) there is no backend, so `createMatch`/`endMatch` synthesize a
 * plausible response and the read endpoints return empty results.
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
export async function getMatchInfo(uuid, accessToken, lang) {
  const client = apiClient()
  if (!client) return null
  const res = await client.get(`/api/match/${uuid}/info?lang=${lang ?? 'en'}`, authConfig(accessToken))
  return res.data
}

/**
 * Complete a match by triggering the configured end-game event.
 * The backend resolves `uuidEvent` against the match's story and only succeeds
 * (200, `{ status: 'ENDED', uuid }`) when it matches the story's
 * `idEventEndGame`. Returns `406` when the event is not the end-game event
 * (`EVENT_NOT_END_GAME`) and `404` when the caller does not own the match.
 * In mock mode there is no backend, so we synthesize the success response.
 */
export async function endMatch(uuidMatch, uuidEvent, accessToken) {
  const client = apiClient()
  if (!client) return { status: 'ENDED', uuid: uuidMatch ?? mockUuid() }
  const res = await client.patch(
    `/api/match/${uuidMatch}/end/${uuidEvent}`,
    null,
    authConfig(accessToken),
  )
  return res.data
}

/** Synthesize a CharacterInstance mirroring what the backend would return. */
function mockCharacter(uuidMatch, payload) {
  return {
    uuid: mockUuid(),
    matchUuid: uuidMatch ?? null,
    characterTemplateUuid: payload?.characterTemplateUuid ?? null,
    classUuid: payload?.classUuid ?? null,
    dexterity: 1, intelligence: 1, constitution: 1,
    energy: 0, life: 1, sad: 0,
    idLocation: null, locationUuid: null, locationName: null,
    isSleeping: 0, isComa: 0,
    traitUuids: payload?.traitUuids ?? [],
    food: 0, magic: 0, coin: 0,
  }
}

/**
 * Step 21 — join a match: instantiate the caller's character. The optional
 * `payload` carries the loadout (characterTemplateUuid / classUuid / traitUuids);
 * when omitted the backend falls back to the loadout stored on the match.
 * Throws on a backend error; mock mode synthesizes a character.
 */
export async function joinMatch(uuidMatch, payload, accessToken) {
  const client = apiClient()
  if (!client) return mockCharacter(uuidMatch, payload)
  const res = await client.post(
    `/api/matches/${uuidMatch}/join`,
    payload ?? {},
    authConfig(accessToken),
  )
  return res.data
}

/** List the characters present in a match. */
export async function getMatchPlayers(uuidMatch, accessToken) {
  const client = apiClient()
  if (!client) return []
  const res = await client.get(`/api/match/${uuidMatch}/players`, authConfig(accessToken))
  return res.data
}

/** Retrieve a single character's full detail within a match. */
export async function getCharacter(uuidMatch, uuidCharacter, accessToken) {
  const client = apiClient()
  if (!client) return null
  const res = await client.get(
    `/api/match/${uuidMatch}/characters/${uuidCharacter}`,
    authConfig(accessToken),
  )
  return res.data
}

/* ── Step 24 — single-player turn cycle ───────────────────────────────────── */

/** Synthesize a TurnSequence mirroring what the backend would return (mock). */
function mockSequence(uuidMatch, status = 'RUNNING') {
  return {
    matchUuid: uuidMatch ?? null,
    currentClock: 0,
    status,
    activeCharacterUuid: null,
    queue: [],
  }
}

/**
 * Start a match: CREATED → RUNNING, build the turn queue and activate the first
 * turn. Returns the resulting turn sequence. Throws on a backend error
 * (409 MATCH_NOT_STARTABLE / NO_CHARACTERS_JOINED, 404 MATCH_NOT_FOUND).
 */
export async function startMatch(uuidMatch, accessToken) {
  const client = apiClient()
  if (!client) return mockSequence(uuidMatch, 'RUNNING')
  const res = await client.post(
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
  const client = apiClient()
  if (!client) {
    return {
      matchUuid: uuidMatch ?? null,
      passedCharacterUuid: null,
      nextActiveCharacterUuid: null,
      status: 'RUNNING',
    }
  }
  const res = await client.post(
    `/api/gameplay/${uuidMatch}/action/pass`,
    null,
    authConfig(accessToken),
  )
  return res.data
}

/** Read the current turn queue with statuses for a match owned by the caller. */
export async function getTurnSequence(uuidMatch, accessToken) {
  const client = apiClient()
  if (!client) return mockSequence(uuidMatch)
  const res = await client.get(
    `/api/match/${uuidMatch}/turn-sequence`,
    authConfig(accessToken),
  )
  return res.data
}

/* ── Step 25/26 — time advancement & clock cycle ──────────────────────────── */

/** Synthesize a ClockResponse mirroring what the backend would return (mock). */
function mockClock(uuidMatch) {
  return {
    matchUuid: uuidMatch ?? null,
    currentClock: 0,
    clockLabelSingular: null,
    clockLabelPlural: null,
    anyCharacterSleeping: false,
    characters: [],
  }
}

/**
 * Read the current clock, story labels and per-character sleeping/energy state.
 * Any participant in the match may call this. Throws on a backend error
 * (404 MATCH_NOT_FOUND); mock mode returns an empty clock at 0.
 */
export async function getMatchClock(uuidMatch, accessToken) {
  const client = apiClient()
  if (!client) return mockClock(uuidMatch)
  const res = await client.get(
    `/api/match/${uuidMatch}/clock`,
    authConfig(accessToken),
  )
  return res.data
}

/**
 * Step 27 — read the current weather of a match (GET /api/matches/{uuid}/weather).
 * Returns the weather payload, or null when none is set yet (the backend answers
 * 404 WEATHER_NOT_FOUND, which we map to null so callers can render nothing).
 * Mock mode returns null.
 */
export async function getMatchWeather(uuidMatch, accessToken) {
  const client = apiClient()
  if (!client) return null
  try {
    const res = await client.get(
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
 * NOT_YOUR_TURN / MATCH_NOT_RUNNING, 404 MATCH_NOT_FOUND); mock mode synthesizes
 * a success response.
 */
export async function sleepCharacter(uuidMatch, accessToken) {
  const client = apiClient()
  if (!client) {
    return {
      matchUuid: uuidMatch ?? null,
      characterUuid: null,
      isSleeping: true,
      timeEndTriggered: false,
      currentClock: 0,
    }
  }
  const res = await client.post(
    `/api/gameplay/${uuidMatch}/action/sleep`,
    null,
    authConfig(accessToken),
  )
  return res.data
}

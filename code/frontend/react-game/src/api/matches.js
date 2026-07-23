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
 * Step 28.7 — read the consolidated log timeline of a match owned by the caller
 * (GET /api/matches/{uuid}/logs). Cursor-paginated: pass `cursor` (the previous
 * response's `nextCursor`) to fetch the following page. WEATHER and MOVEMENT
 * entries carry their resolved `card`; character-scoped entries carry
 * `characterUuid` / `characterName`. Returns
 * `{ matchUuid, currentClock, logs, nextCursor, limit, total, order }`.
 *
 * v0.30.3 — the timeline is requested newest-first (`order=desc`): the player sees
 * what just happened at the top and "load more" walks back into the past. Pass
 * `order: 'asc'` to get the API's own default (oldest first) instead.
 */
export async function getMatchLogs(uuidMatch, accessToken,
                                   { limit, cursor, lang, order = 'desc' } = {}) {
  const config = authConfig(accessToken)
  const params = {}
  if (limit != null) params.limit = limit
  if (cursor) params.cursor = cursor
  if (lang) params.lang = lang
  if (order) params.order = order
  if (Object.keys(params).length) config.params = params
  const res = await apiClient().get(`/api/matches/${uuidMatch}/logs`, config)
  return res.data
}

/**
 * Step 28 — read the visited locations of a match, each with its character count
 * and the per-neighbor `totalEnergyCost` resolved for the current weather (the
 * neighbor list itself comes from /info; this endpoint carries the resolved
 * cost). Returns `{ matchUuid, locations: [] }`.
 */
export async function getMatchLocations(uuidMatch, accessToken, lang) {
  const config = authConfig(accessToken)
  if (lang) config.params = { ...(config.params ?? {}), lang }
  const res = await apiClient().get(
    `/api/match/${uuidMatch}/locations`,
    config,
  )
  return res.data
}

/* ── Step 29 — normal events (player-triggered actions) ───────────────────── */

/**
 * Trigger a NORMAL or ONCE event at the character's location
 * (POST /api/gameplay/{uuid}/action/execute-event).
 *
 * Whether an event can be triggered is already known before calling: every event in
 * `locationsActive[].events` of match-info carries `available` and, when false, the
 * `reason` — the very code this endpoint would return as its error. So the board can
 * render a locked action without guessing, and this call is only made for an available one.
 *
 * Resolves to the execution result: the event's card, one entry per applied effect (each
 * with its OWN card — that is the narrative to show), the itemised stat/registry/item/trait
 * changes, and the flags (`timeEnded`, `comaTriggered`, `gameOver`, …). When
 * `refreshRecommended` is true the caller should reload match-info.
 *
 * Step 30 adds `edgeState`: `sadnessOverflowUuids` and `comaUuids` say who was pushed over
 * an edge, and `allPlayersInComa` that the whole party is down — in which case
 * `comaEventCard` carries the story's own epilogue card. The epilogue's events and effects
 * are kept in `comaExecutedEventUuids` / `comaEffects`, deliberately NOT merged into the
 * top-level `executedEventUuids` / `effects`, so the board can tell the narrative the
 * player triggered from the engine's answer to their collapse.
 *
 * Throws on a backend error: 409 with `ONCE_ALREADY_CONSUMED` / `NOT_ENOUGH_ENERGY` /
 * `WRONG_LOCATION` / …, or 404 `MATCH_NOT_FOUND` / `EVENT_NOT_FOUND`.
 */
export async function executeEvent(uuidMatch, eventUuid, accessToken, lang) {
  const config = authConfig(accessToken)
  if (lang) config.params = { lang }
  const res = await apiClient().post(
    `/api/gameplay/${uuidMatch}/action/execute-event`,
    { eventUuid },
    config,
  )
  return res.data
}

/* ── Step 32 — choice resolution ──────────────────────────────────────────── */

/**
 * Resolve one option of an open choice-event
 * (POST /api/gameplay/{uuid}/action/select-choice).
 *
 * The option alone identifies the resolution: a choice knows the event that owns it, so
 * naming the event too would only create a second version of the truth.
 *
 * Resolves to the execute-event payload — the effects, the itemised stat/registry/item/
 * location changes, the flags, the edge states — plus what only a resolution knows:
 * `narrative` (the post-selection text Step 31 deliberately withheld, so the options
 * could not leak the consequence of a choice not yet made), `choiceCard`, and
 * `choiceEventUuid`/`choiceEventCard` when an effect ran a linked event inline: that card
 * is what the board narrates with. `progressRecorded` says a narrative milestone was
 * logged. `energySpent`/`coinSpent` are always 0 — the cost was paid when the event was
 * opened, and resolving is what that payment bought.
 *
 * `status` is `APPLIED` as usual, or `CHOICES_PENDING` when a linked event turned out to
 * be another choice-event: then `pendingChoices` carries the next set of options.
 *
 * Throws on a backend error: 409 with `CHOICE_NOT_OPEN` (the event was never opened, or
 * has already been resolved) / `CHOICE_NOT_AVAILABLE` (the world moved since the options
 * were served) / `SLEEPING` / `COMA`, or 404 `CHOICE_NOT_FOUND` / `MATCH_NOT_FOUND`.
 */
export async function selectChoice(uuidMatch, choiceUuid, accessToken, lang) {
  const config = authConfig(accessToken)
  if (lang) config.params = { lang }
  const res = await apiClient().post(
    `/api/gameplay/${uuidMatch}/action/select-choice`,
    { choiceUuid },
    config,
  )
  return res.data
}

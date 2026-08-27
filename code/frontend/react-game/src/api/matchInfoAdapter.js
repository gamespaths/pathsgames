/**
 * matchInfoAdapter.js
 *
 * Maps the backend `GET /api/match/{uuid}/info` response (MatchInfoResponse) into
 * the board shape consumed by GameBook: { startLocation, playerStats, locations,
 * actions, endGameCard }.
 *
 * Step 27.x — /info now carries `locationsActive`: the locations occupied by one
 * or more players, each with a resolved `card` plus its `neighbors[]` (with cards)
 * and `events[]` (with cards). The board's current location, move-targets and
 * action cards are derived from the active location matching `players[0].idLocation`.
 * `story` is still passed in for end-game card and graceful fallbacks.
 *
 * Step 0.28.6 — `locations` now lists ONLY the already-visited locations, and the
 * synthetic `name` fields are gone (locations[].name, currentLocationName,
 * players[].locationName). A location's title comes from its card. Neighbors gained
 * `cardLocationFrom`/`cardLocationTo`: the card of the LOCATION at each endpoint of
 * the edge, null while that endpoint is still under fog of war.
 *
 * API shape (consumed):
 *   {
 *     match: { uuid, name, status, currentClock, ... },
 *     currentLocationId, currentLocationUuid,
 *     locations: [{ idLocation, uuid, flagAlreadyActived, clockCounter }],  // visited only
 *     registry:  [{ uuid, key, stringValue, intValue }],
 *     events:    [{ uuid, name, type }],
 *     choices:   [{ uuid, name, type }],
 *     players:   [{ uuid, idLocation, energy, life, sad, ... }],
 *     locationsActive: [{
 *       idLocation, uuid, card,
 *       neighbors: [{ idLocation, uuid, direction, flagBack, energyCost, card,
 *                     idLocationFrom, idLocationTo, cardBack,
 *                     cardLocationFrom, cardLocationTo }],
 *       events:    [{ uuid, type, endGame, card }],
 *     }]
 *   }
 */

import { buildEndGameCard, buildNeighborCard } from "@/utils/loadoutCards"
import { traversalDirection } from "@/utils/mapGraph"

const EMPTY_STATS = {
  life: 0, energy: 0, sadness: 0, experience: 0, food: 0, magic: 0, coins: 0, weight: 0,
  lifeMax: 0, energyMax: 0, sadnessMax: 0, weightMax: 0, items: [],
}

/** Map a single character instance (players[0]) to the PlayerStats bar shape. */
function toPlayerStats(player) {
  if (!player) return { ...EMPTY_STATS, items: [] }
  return {
    life: player.life ?? 0,
    energy: player.energy ?? 0,
    sadness: player.sad ?? 0,
    // Step 27 — max statistics and carried weight projected by /info.
    lifeMax: player.lifeMax ?? 0,
    energyMax: player.energyMax ?? 0,
    sadnessMax: player.sadMax ?? 0,
    weightMax: player.weightMax ?? 0,
    weight: player.weight ?? 0,
    // Step 30 — constitution is what a sadness overflow costs in life; isComa/isSleeping
    // say whether the character can act at all.
    constitution: player.constitution ?? 0,
    isComa: !!player.isComa,
    isSleeping: !!player.isSleeping,
    items: Array.isArray(player.items) ? player.items : [],
    // Selection uuids — used by utils/gamebook to resolve the matching story
    // entity (class/character/trait/difficulty) and its card. /info currently
    // projects characterTemplateUuid; the others are passed through when present
    // (null/empty otherwise) so the cards degrade gracefully.
    characterTemplateUuid: player.characterTemplateUuid ?? null,
    classUuid: player.classUuid ?? null,
    traitUuids: Array.isArray(player.traitUuids) ? player.traitUuids : [],
    difficultyUuid: player.difficultyUuid ?? null,
    // Step 35 — the backpack resources, now projected by /info on every player.
    // Mind the naming: the backend field is `coin` (singular), the stat key is `coins`.
    food: player.food ?? 0,
    magic: player.magic ?? 0,
    coins: player.coin ?? 0,
    // Not yet projected by /info — defaulted until step 38 wires experience.
    experience: 0,

    intelligence: player.intelligence ?? 0,
    dexterity: player.dexterity ?? 0,
  }
}

/**
 * Convert a MatchInfoResponse (real or mock — same shape) plus optional story
 * content into the GameBook board object.
 *
 * @param {object|null} info  - MatchInfoResponse
 * @param {object|null} story - story summary (provides cards for enrichment)
 * @returns {{ startLocation, playerStats, locations, actions, endGameCard, match }}
 */
export function matchInfoToGameData(info, story = null,t) {
  if (!info) {
    return { info:info, actualLocationCard: null, playerStats: { ...EMPTY_STATS }, locations: [], actions: [], endGameCard: null, match: null }
  }

  const playerStats = toPlayerStats(info.players?.[0])

  // `t` is the i18n translate fn (passed by GamePage). Guard against callers /
  // tests that omit it so the adapter never throws on a missing translator.
  const tr = typeof t === 'function' ? t : (k) => k

  // The active location is the one the player currently stands on. Prefer the
  // entry matching players[0].idLocation, falling back to the first active one.
  const playerLoc = info.players?.[0]?.idLocation ?? null
  const activeList = Array.isArray(info.locationsActive) ? info.locationsActive : []
  const active = activeList.find(l => l.idLocation === playerLoc) ?? activeList[0] ?? null
  //console.log("active location", active,playerLoc, activeList);
  const activeCard = active?.card ?? null
  const actualLocationCard = activeCard
    ? activeCard
    : info.currentLocationUuid
      ? {
        uuid: info.currentLocationUuid,
        name: '',
        description: '',
        urlImage: story?.card?.urlImage ?? null,
        awesomeIcon: story?.card?.awesomeIcon ?? 'fas fa-map-marker-alt',
      }
      : null

  // Step 26 — the residual location time counter (gaming_state_locations.clock_counter)
  // for the location the player currently stands on, surfaced on the location card so
  // LocationCard can render it as a statistic when > 0.
  // v0.28.6 — /info locations[] is the VISITED set of the match, the same one the
  // backend gates the fog of war on, so a destination is "already explored" here
  // exactly when its location card resolves.
  const visitedIds = new Set((info.locations ?? [])
    .map(l => l.idLocation)
    .filter(id => id != null))

  const stateLoc = (info.locations ?? []).find(l => l.idLocation === playerLoc) ?? null
  const actualLocationCounter = stateLoc?.clockCounter ?? null
  const actualLocationCardWithCounter = actualLocationCard
    ? { ...actualLocationCard, clockCounter: actualLocationCounter }
    : actualLocationCard

  // Neighbor locations of the active location become the board's move-target cards.
  // Step 0.28.2 — when the player stands on the edge's `to` location, prefer the
  // optional return card (cardBack); otherwise show the forward card.
  const locations = (active?.neighbors ?? []).map(n => {
    // When the character stands on the edge's `to` endpoint, the neighbor is a
    // RETURN move: the destination is the `from` endpoint and the travel
    // direction is the opposite of the authored one.
    const playerAtTo = active?.idLocation != null && active.idLocation === n.idLocationTo
    // Step 0.28.6 — the LOCATION cards of the two endpoints, each null while that
    // endpoint is unvisited. The active location is always visited, so the origin
    // card resolves; the destination card appears only once explored.
    const destLocationCard = (playerAtTo ? n.cardLocationFrom : n.cardLocationTo) ?? null
    const originLocationCard = (playerAtTo ? n.cardLocationTo : n.cardLocationFrom) ?? null

    // Step 0.28.5 — when a neighbor has NO card at all, fall back to the fixed
    // "neighbor" card from data/images.json, titled by the move direction and
    // described with the current + destination location names. The destination
    // name stays null (→ "Unexplored location") until it has been visited.
    // From = where the character stands now, To = where the move lands: the
    // origin/destination swap already happened above, so these two must NOT be
    // swapped again.
    const fromName = actualLocationCard?.title ?? originLocationCard?.title ?? null
    const toName = destLocationCard?.title ?? null
    // `n.direction` is the AUTHORED edge direction (from→to). On a return move the
    // character travels the other way, so the card must show the opposite.
    const travelDirection = traversalDirection(n.direction, playerAtTo)
    // "Back to" is only honest when the party has ALREADY been to the destination:
    // walking an edge against its authored direction into a never-visited location
    // is still a plain "Move to".
    const destinationExplored = n.idLocation != null && visitedIds.has(n.idLocation)
    const isBackMove = playerAtTo && destinationExplored
    const genericNeighborCard = buildNeighborCard(tr, travelDirection, fromName, toName, isBackMove)

    // Precedence: the return LINK card when moving back, then the forward LINK
    // card, then the destination's own LOCATION card, then the generic fallback.
    const displayCard = ((playerAtTo && n.cardBack) ? n.cardBack : n.card)
      ?? destLocationCard
      ?? genericNeighborCard

    return {
      uuid: n.uuid ?? null,
      idLocation: n.idLocation ?? null,
      name: displayCard?.title ?? '',
      description: displayCard?.description ?? '',
      urlImage: displayCard?.urlImage ?? null,
      awesomeIcon: displayCard?.awesomeIcon ?? 'fas fa-location-arrow',
      direction: travelDirection,
      energyCost: n.energyCost ?? null,
      // v0.35.3 — the EDGE's resource price. Unlike energy, which sums edge + destination
      // entry + weather and is served pre-summed by /locations, these have a single source:
      // what is written here is exactly what the move will take.
      costFood: n.costFood ?? 0,
      costMagic: n.costMagic ?? 0,
      costCoin: n.costCoin ?? 0,
      card: displayCard ?? null,
      // The backend's own move verdict: `available` is what action/move would answer, and
      // `reason` the code it would refuse with (COMA, SLEEPING, INSUFFICIENT_ENERGY, …).
      // An older backend sends neither: treat the move as allowed, as before, and let the
      // card fall back to its local energy check.
      available: n.available ?? null,
      reason: n.reason ?? null,
    }
  })

  // Lean events + choices still drive the END_GAME flow (uuidEvent is what
  // endMatch expects). Step 27.x — ADD the active location's enriched event cards
  // for display; the lean list is empty today so there is no duplication.
  const leanActions = [...(info.events ?? []), ...(info.choices ?? [])].map(e => ({
    uuid: e.uuid,
    uuidEvent: e.uuid,
    name: e.name,
    type: e.type ?? null,
    awesomeIcon: 'fas fa-bolt',
    endGame: e.type === 'END_GAME',
    card: e.card ?? null, 
  }))
  const eventActions = (active?.events ?? []).map(e => ({
    uuid: e.uuid,
    uuidEvent: e.uuid,
    name: e.card?.title ?? '',
    description: e.card?.description ?? '',
    type: e.type ?? null,
    awesomeIcon: e.card?.awesomeIcon ?? 'fas fa-bolt',
    // Step 0.25.4 — the backend now flags the story's end-game event explicitly.
    endGame: e.endGame === true,
    card: e.card ?? null,
    // Step 29 — the backend's own check-procedure verdict, the same one execute-event
    // enforces. `reason` is the error code it would return (NOT_ENOUGH_ENERGY,
    // ONCE_ALREADY_CONSUMED, WRONG_LOCATION, …). Absent on an older backend, in which
    // case the action is treated as not executable rather than assumed to work.
    available: e.available === true,
    reason: e.reason ?? null,
    energy: e?.energy ?? 0,
    // v0.35.3 — an event can cost coins, food and magic on top of energy. Absent on an
    // older backend, where 0 reads as "this action asks for nothing".
    coin: e?.coin ?? 0,
    food: e?.food ?? 0,
    magic: e?.magic ?? 0,
  }))
  const actions = [...leanActions, ...eventActions]

  const endGameCard = buildEndGameCard(tr);// story?.endGameCard ?? story?.card ?? null

  return { info: info, actualLocationCard: actualLocationCardWithCounter, 
    playerStats, locations, actions, endGameCard, match: info.match ?? null }
}

export default matchInfoToGameData

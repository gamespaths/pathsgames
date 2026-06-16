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
 * API shape (consumed):
 *   {
 *     match: { uuid, name, status, currentClock, ... },
 *     currentLocationId, currentLocationUuid, currentLocationName,
 *     locations: [{ idLocation, uuid, flagAlreadyActived, clockCounter, name }],
 *     registry:  [{ uuid, key, stringValue, intValue }],
 *     events:    [{ uuid, name, type }],
 *     choices:   [{ uuid, name, type }],
 *     players:   [{ uuid, idLocation, energy, life, sad, ... }],
 *     locationsActive: [{
 *       idLocation, uuid, card,
 *       neighbors: [{ idLocation, uuid, direction, flagBack, energyCost, card }],
 *       events:    [{ uuid, type, card }],
 *     }]
 *   }
 */

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
    items: Array.isArray(player.items) ? player.items : [],
    // Selection uuids — used by utils/gamebook to resolve the matching story
    // entity (class/character/trait/difficulty) and its card. /info currently
    // projects characterTemplateUuid; the others are passed through when present
    // (null/empty otherwise) so the cards degrade gracefully.
    characterTemplateUuid: player.characterTemplateUuid ?? null,
    classUuid: player.classUuid ?? null,
    traitUuids: Array.isArray(player.traitUuids) ? player.traitUuids : [],
    difficultyUuid: player.difficultyUuid ?? null,
    // Not yet projected by /info — defaulted until a richer endpoint exists.
    experience: 0,
    food: 0,
    magic: 0,
    coins: 0,
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
export function matchInfoToGameData(info, story = null) {
  if (!info) {
    return { actualLocationCard: null, playerStats: { ...EMPTY_STATS }, locations: [], actions: [], endGameCard: null, match: null }
  }

  const playerStats = toPlayerStats(info.players?.[0])

  // The active location is the one the player currently stands on. Prefer the
  // entry matching players[0].idLocation, falling back to the first active one.
  const playerLoc = info.players?.[0]?.idLocation ?? null
  const activeList = Array.isArray(info.locationsActive) ? info.locationsActive : []
  const active = activeList.find(l => l.idLocation === playerLoc) ?? activeList[0] ?? null
  console.log("active location", active,playerLoc, activeList);
  const activeCard = active?.card ?? null

  const actualLocationCard = activeCard
    ? activeCard /*{
      uuid: active.uuid ?? info.currentLocationUuid ?? null,
      name: activeCard.title ?? info.currentLocationName ?? '',
      description: activeCard.description ?? '',
      urlImage: activeCard.urlImage ?? story?.card?.urlImage ?? null,
      awesomeIcon: activeCard.awesomeIcon ?? story?.card?.awesomeIcon ?? 'fas fa-map-marker-alt',
    }*/
    : (info.currentLocationUuid || info.currentLocationName)
      ? {
        uuid: info.currentLocationUuid ?? null,
        name: info.currentLocationName ?? '',
        description: '',
        urlImage: story?.card?.urlImage ?? null,
        awesomeIcon: story?.card?.awesomeIcon ?? 'fas fa-map-marker-alt',
      }
      : null

  // Neighbor locations of the active location become the board's move-target cards.
  const locations = (active?.neighbors ?? []).map(n => ({
    uuid: n.uuid ?? null,
    idLocation: n.idLocation ?? null,
    name: n.card?.title ?? '',
    description: n.card?.description ?? '',
    urlImage: n.card?.urlImage ?? null,
    awesomeIcon: n.card?.awesomeIcon ?? 'fas fa-location-arrow',
    direction: n.direction ?? null,
    energyCost: n.energyCost ?? null,
  }))

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
  }))
  const eventActions = (active?.events ?? []).map(e => ({
    uuid: e.uuid,
    uuidEvent: e.uuid,
    name: e.card?.title ?? '',
    description: e.card?.description ?? '',
    type: e.type ?? null,
    awesomeIcon: e.card?.awesomeIcon ?? 'fas fa-bolt',
    endGame: e.type === 'END_GAME',
  }))
  const actions = [...leanActions, ...eventActions]

  const endGameCard = story?.endGameCard ?? story?.card ?? null

  return { actualLocationCard, playerStats, locations, actions, endGameCard, match: info.match ?? null }
}

export default matchInfoToGameData

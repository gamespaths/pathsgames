/**
 * matchInfoAdapter.js
 *
 * Maps the backend `GET /api/match/{uuid}/info` response (MatchInfoResponse) into
 * the board shape consumed by GameBook: { startLocation, playerStats, locations,
 * actions, endGameCard }.
 *
 * The /info API is lean (uuid/name/type for events & choices; location states with
 * a name; character stats on players[]). It does NOT carry per-entity cards
 * (images/descriptions) — those live in the story content, so `story` is passed in
 * to enrich the start location and end-game card where possible. Richer per-event
 * cards await a dedicated content endpoint; until then names/icons are derived.
 *
 * API shape (consumed):
 *   {
 *     match: { uuid, name, status, currentClock, ... },
 *     currentLocationId, currentLocationUuid, currentLocationName,
 *     locations: [{ idLocation, uuid, flagAlreadyActived, clockCounter, name }],
 *     registry:  [{ uuid, key, stringValue, intValue }],
 *     events:    [{ uuid, name, type }],
 *     choices:   [{ uuid, name, type }],
 *     players:   [{ uuid, energy, life, sad, isSleeping, isComa, ... }]
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
    return { startLocation: null, playerStats: { ...EMPTY_STATS }, locations: [], actions: [], endGameCard: null, match: null }
  }

  const playerStats = toPlayerStats(info.players?.[0])

  const startLocation = (info.currentLocationUuid || info.currentLocationName)
    ? {
      uuid: info.currentLocationUuid ?? null,
      name: info.currentLocationName ?? '',
      description: '',
      urlImage: story?.card?.urlImage ?? null,
      awesomeIcon: story?.card?.awesomeIcon ?? 'fas fa-map-marker-alt',
    }
    : null

  // The board's left card shows the story card when there are no move-target
  // locations (GameBook keys the left page off `gameData.locations`). /info.locations
  // is *visited* location state, not neighbor move-targets, so it is intentionally
  // NOT surfaced as board locations — this keeps the left card on the story card,
  // as before. Mapping real neighbours awaits a dedicated content endpoint.
  const locations = []

  // Events + choices become the action cards. An event flagged END_GAME drives the
  // GameBook end-game flow (uuidEvent is what endMatch expects).
  const actions = [...(info.events ?? []), ...(info.choices ?? [])].map(e => ({
    uuid: e.uuid,
    uuidEvent: e.uuid,
    name: e.name,
    type: e.type ?? null,
    awesomeIcon: 'fas fa-bolt',
    endGame: e.type === 'END_GAME',
  }))

  const endGameCard = story?.endGameCard ?? story?.card ?? null

  return { startLocation, playerStats, locations, actions, endGameCard, match: info.match ?? null }
}

export default matchInfoToGameData

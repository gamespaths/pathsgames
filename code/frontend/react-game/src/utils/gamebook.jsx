import ClockWidget from '@/features/gameplay/ClockWidget'
import PlayerStats from '@/features/gameplay/cards/PlayerStats'

/**
 * gamebook.js — builders for the in-game characteristics cards and the resolver
 * that maps the player's current selection (class / character / trait /
 * difficulty) back to the matching story entity (which carries its card).
 *
 * The selection uuids are read from `playerStats` (projected by
 * matchInfoAdapter from `GET /api/match/{uuid}/info`) and looked up against the
 * story content lists. Missing uuids resolve to `null`, so the cards degrade
 * gracefully when a selection is not yet projected by the backend.
 */

/**
 * Left "characteristics" card: the clock as title, no image/icon, the player
 * description as body. Shown with PlayerStats injected over the image by the
 * caller (childrenIntoImage).
 */
export function buildCardCharacteristics(story, playerStats, clock , weather) {
  const card = weather?.card ? { ...weather.card } : { ...story?.card }
  //card.title = <ClockWidget clock={clock} className="display-inline-grid display-grid" badgeClassName="" />
  //card.urlImage = null
  //card.awesomeIcon = null
  //card.description = playerStats?.description ?? ''
  return card
}

/**
 * Right "characteristics" card (preview page): the clock as title and a JSX
 * body with the full PlayerStats plus the SleepButton. `descriptionTag` marks
 * the description as a React element so BookPageContent renders it directly.
 */
export function buildCardCharacteristicsRight(story, playerStats, clock, weather, { matchUuid, accessToken, onSlept } = {}) {
  const card = weather?.card ? { ...weather.card } : { ...story?.card }
  
  //card.urlImage = null
  //card.awesomeIcon = null
  //TODO card.title= weathere
  //EX card.title = <ClockWidget clock={clock} className="display-inline-flex ml-2" title={story?.title} />
  // Derive a stats copy (never mutate the caller's object; it may be undefined
  // when no match data is loaded yet).
  const stats = {
    ...(playerStats ?? {}),
    clock: clock?.currentClock,
    clockLabelSingular: clock?.clockLabelSingular,
  }

  card.description = (
    <>
      <PlayerStats stats={stats} plainFlag={true} showItems={false} />
    </>
  )
  card.descriptionTag = true
  return card
}

/**
 * Maps a selection type to the story content list that holds its entities and
 * the playerStats field that holds the selected uuid(s).
 */
const SELECTION_CONFIG = {
  class:      { storyList: 'classes',            uuidField: 'classUuid' },
  character:  { storyList: 'characterTemplates', uuidField: 'characterTemplateUuid' },
  trait:      { storyList: 'traits',             uuidField: 'traitUuids' }, // array of uuids
  difficulty: { storyList: 'difficulties',       uuidField: 'difficultyUuid' },
}

/** How many entities the story offers for a selection type (for the card count). */
export function storySelectionCount(story, type) {
  const cfg = SELECTION_CONFIG[type]
  return cfg ? (story?.[cfg.storyList]?.length ?? 0) : 0
}

/**
 * Resolve the story entity (carrying its `card`/`name`/`icon`) that the player
 * currently has selected for `type`, by reading the uuid stored on
 * `playerStats` and matching it against the story content list.
 *
 * For multi-select types (traits) the selected uuid at the given index is used.
 * Returns `null` when nothing matches.
 */
export function resolveSelectionEntity(story, playerStats, gameData, type, index=0) {
  const cfg = SELECTION_CONFIG?.[type]
  if (!cfg) {console.log("type not found", type , story);return null;}
  const list = story?.[cfg.storyList]
  if (!Array.isArray(list)) { /*console.log("list not found for type", type, story);*/return null;}
  const raw = playerStats?.[cfg.uuidField]
  let uuid = Array.isArray(raw) ? raw[index] : raw
  if (!uuid) { 
    const raw = gameData?.match?.[cfg.uuidField]
    uuid = Array.isArray(raw) ? raw[index] : raw
  }
  if (!uuid) {console.log("uuid not found for type", uuid, type, playerStats);return null;}
//console.log("aa",playerStats, gameData, type, index, uuid)
//console.log("bb", list, list.find(e => e.uuid === uuid));
  return list.find(e => e.uuid === uuid) ?? null
}

/** How many traits the player currently has selected (for the trait card count badge). */
export function selectedTraitCount(playerStats) {
  return Array.isArray(playerStats?.traitUuids) ? playerStats.traitUuids.length : 0
}

/**
 * Key of one entry in the move-cost map: a move is identified by BOTH endpoints.
 *
 * The /locations payload names a neighbor by the uuid of the LOCATION at the other
 * end, not by the edge — so every path leading into the same place shares that uuid
 * while costing something different (`base edge + entry cost + weather` depends on
 * which edge you walk). Keyed on the destination alone the entries overwrite each
 * other, and the survivor is decided by the payload order: the location the player
 * stands on is listed first, so its — correct — cost is the one every later entry
 * overwrites. Hence the origin belongs in the key.
 */
export function movementCostKey(originLocationId, destinationUuid) {
  return `${originLocationId}->${destinationUuid}`
}

/**
 * v0.35.5 — when the (i) bookmark should shout: the character is one hit from a coma, out
 * of energy, or as sad as they can get. A statistic the backend has not projected yet is
 * never an alarm — an unknown value is not a bad one.
 */
export function isStatsCritical(playerStats) {
  const num = key => (Number.isFinite(playerStats?.[key]) ? playerStats[key] : null)
  const life = num('life')
  const energy = num('energy')
  const sadness = num('sadness')
  const sadnessMax = num('sadnessMax')
  return (life !== null && life < 2)
    || (energy !== null && energy < 2)
    || (sadness !== null && sadnessMax !== null && sadness > sadnessMax - 1)
}

/**
 * The bag is OVER its capacity — strictly heavier than it can carry. That is the state the
 * player has to fix, so it both reddens the bag bookmark and grows a bin on the item rows.
 * A weight the backend has not projected is never an alarm.
 */
export function isBagOverloaded(playerStats) {
  const weight = playerStats?.weight
  const weightMax = playerStats?.weightMax
  if (!Number.isFinite(weight) || !Number.isFinite(weightMax) || weightMax <= 0) return false
  return weight > weightMax
}

/**
 * The move-cost map consumed by `movementEnergyCost`, built from a /locations
 * payload: one entry per (origin location, destination) pair.
 */
export function buildLocationCosts(payload) {
  const map = {}
  for (const loc of payload?.locations ?? []) {
    for (const n of loc.neighbors ?? []) {
      if (n.uuid != null && loc.idLocation != null) {
        map[movementCostKey(loc.idLocation, n.uuid)] = n.totalEnergyCost
      }
    }
  }
  return map
}

/**
 * The weather-resolved energy cost the player must pay to reach one neighbor from
 * `originLocationId`: the /locations `totalEnergyCost` of that exact pair when
 * known, else the base edge cost carried on the location. Kept as a named helper
 * so the sleep gate and MovementCard stay in agreement on how a move's cost is
 * computed.
 *
 * A destination the payload knows no path to FROM HERE — a far node picked on the
 * map — resolves to the base edge cost rather than to some other origin's total.
 */
export function movementEnergyCost(location, locationCosts = {}, originLocationId = null) {
  if (locationCosts==null){
    return 0
  }
  const resolved = location?.uuid != null && originLocationId != null
    ? locationCosts[movementCostKey(originLocationId, location.uuid)]
    : undefined
  return resolved ?? location?.energyCost ?? 0
}

/**
 * Whether to surface the "go to sleep" card on the board.
 *
 * Rule: show it as soon as the player CANNOT afford at least one thing on the board — one
 * movement or one costed action out of energy reach is enough. Resting is what buys that
 * option back, so the card belongs on screen while anything is priced out of it, not only
 * once everything is. The card hides when every move and every costed action is affordable.
 *
 * This is intentionally a small, dedicated pure function so the rule can evolve without
 * touching the board's render. Only actions with a positive `energyCost` count: an action
 * with `energyCost` 0 or absent (the current API contract, which does not expose it yet) can
 * never be out of reach. End-game actions are escape hatches (no energy cost, they end the
 * match), so they are excluded too.
 */
export function checkShowToSleepCard({ playerStats, locations = [], actions = [], locationCosts = {},
  hereLocationId = null } = {}) {
  const energy = playerStats?.energy ?? 0
  const moves = Array.isArray(locations) ? locations : []
  // Only energy-costing, non-end-game actions gate the sleep card.
  const acts = (Array.isArray(actions) ? actions : [])
    .filter(action => !action?.endGame && (action?.energyCost ?? 0) > 0)
  // The moves on the board all leave the location the player stands on, so that is
  // the origin every cost is looked up against.
  const unaffordableMovement = moves.some(loc =>
    energy < movementEnergyCost(loc, locationCosts, hereLocationId))
  const unaffordableAction = acts.some(action => energy < action.energyCost)

  // Unchanged, and independent of energy: a board whose every location is closed leaves
  // resting as the only thing left to do. An empty board satisfies it too.
  const allLocationNotAvailable = moves.every(loc => loc?.available === false)
  return unaffordableMovement || unaffordableAction || allLocationNotAvailable
}

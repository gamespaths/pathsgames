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
export function buildCardCharacteristics(story, playerStats, clock) {
  const card = { ...story?.card }
  card.title = <ClockWidget clock={clock} className="display-inline-grid display-grid" badgeClassName="" />
  card.urlImage = null
  card.awesomeIcon = null
  card.description = playerStats?.description ?? ''
  return card
}

/**
 * Right "characteristics" card (preview page): the clock as title and a JSX
 * body with the full PlayerStats plus the SleepButton. `descriptionTag` marks
 * the description as a React element so BookPageContent renders it directly.
 */
export function buildCardCharacteristicsRight(story, playerStats, clock, { matchUuid, accessToken, onSlept } = {}) {
  const card = { ...story?.card }
  
  card.urlImage = null
  card.awesomeIcon = null
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
      <PlayerStats stats={stats} plainFlag={true} />
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
  if (!Array.isArray(list)) {console.log("list not found for type", type, story);return null;}
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

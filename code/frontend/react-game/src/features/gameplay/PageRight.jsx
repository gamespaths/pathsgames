import Card from '@/components/layout/Card'
import WeatherCard from './cards/WeatherCard'
import CloseGameCard from './cards/CloseGameCard'
import EndGameCard from './cards/EndGameCard'
import ComaCard from './cards/ComaCard'
import SadnessCard from './cards/SadnessCard'
import LocationCard from './cards/LocationCard'
import MovementCard from './cards/MovementCard'
import ItemsCards from './cards/ItemsCards'
import RegistryCards from './cards/RegistryCards'
import PendingChoicesList from './cards/PendingChoicesList'
import AutomaticEvents from './cards/AutomaticEvents'
import MatchLogCard from '@/features/matches/MatchLogCard'
import PageRightInfo from './PageRightInfo'
import PageRightMain from './PageRightMain'
import { movementCostKey } from '@/utils/gamebook'

/**
 * The dedicated event pages (weather / close / endgame / matchlog / coma / sadness) plus the
 * plain right preview, which renders the same page Card the left page uses. Each has a back
 * arrow that clears previewRight.
 */
function RightPreview({ previewRight, story, playerStats, matchUuid, accessToken,
  activeAction, onBack, onEndGamePreview, onEndGame }) {
  switch (previewRight?.kind) {
    case 'weather':
      return <WeatherCard weather={previewRight.weather} story={story} onBack={onBack} />
    case 'close':
      return <CloseGameCard story={story} onExit={previewRight.onExit} onBack={onBack} />
    case 'endgame':
      return <EndGameCard story={story} action={activeAction}
        handleEndGamePreviewFull={onEndGamePreview}
        handleEndGame={onEndGame} onBack={onBack} variant="page" />
    case 'matchlog':
      return <MatchLogCard matchUuid={matchUuid} accessToken={accessToken}
        story={story} onBack={onBack} />
    case 'coma':
      return <ComaCard story={story} allPlayers={previewRight.allPlayers}
        comaEventCard={previewRight.card} onBack={onBack} onForward={previewRight.onForward} />
    case 'sad':
      return <SadnessCard story={story} lifeLost={playerStats?.constitution ?? null}
        onBack={onBack} onForward={previewRight.onForward} />
    case 'preview':
      return <Card variant="page"
        card={previewRight.card}
        entity={previewRight.entity}
        entityType={previewRight.type}
        loading={false}
        story={story}
        onClose={onBack}
        lockedReason={previewRight.lockedReason}
        statItemsToPageContent={previewRight.statItemsToPageContent}
        {...previewRight.additionalProps}
      />
    default:
      return null
  }
}

/**
 * PageRight — the RIGHT reading page, in priority order: an open preview, an open
 * choice-event (a decision outranks news), the wake-up list, the map's selected location,
 * the backpack, the statistics list, else the board's action cards.
 */
export default function PageRight(props) {
  const {
    view, previewRight, pendingChoices, counterZero, story, storyFull, t, gameData, playerStats,
    playerUuid, weather, clock, actualLocationCard, locations, actions, locationCosts,
    hereLocationId, mapSelected, matchUuid, accessToken, choiceInFlight, endError,
    onPreview, onCloseRight, onCloseChoices, onSelectChoice, onDismissCounterZero,
    onEnterCurrentLocation, onMoved, onError, onDone, onDropped, onItemUsed, onSlept,
    onOpenMap, onOpenItems, onOpenRegistry, onOpenInfo, onPreviewMatchLog,
    onEndGame, onEndGamePreview,
    onForceSleepCard, sleepCardForced, activeAction, onExit,
  } = props

  if (previewRight) {
    return <RightPreview previewRight={{ ...previewRight, weather, onExit }}
      story={story} playerStats={playerStats} matchUuid={matchUuid} accessToken={accessToken}
      activeAction={activeAction} onBack={onCloseRight}
      onEndGamePreview={onEndGamePreview} onEndGame={onEndGame} />
  }
  // Step 31 — an open choice-event owns the right page: the options as small cards, plus the
  // "do nothing" exit. An (i) preview of an option overlays via previewRight (checked
  // first), so closing that overlay returns here to the list.
  if (pendingChoices) {
    return <PendingChoicesList story={story} choices={pendingChoices.choices}
      onPreview={onPreview} onSelect={onSelectChoice}
      busy={choiceInFlight} onDoNothing={onCloseChoices} />
  }
  // Step 33 — the wake-up list: what happened in the world while the party slept. Below the
  // choices, which are a decision and outrank news; above the weather and the board, which
  // are the state the player returns to once they have read it.
  if (counterZero?.length) {
    return <AutomaticEvents story={story} items={counterZero} playerUuid={playerUuid}
      onPreview={onPreview} onDismiss={onDismissCounterZero} />
  }
  // Step 0.28.5 — while the map fills the left page, the right page shows the location
  // selected on the map, else the current location.
  if (view === 'map') {
    if (!mapSelected) {
      return <LocationCard locationsActive={gameData?.info?.locationsActive}
        location={actualLocationCard} card={actualLocationCard} story={story}
        onEnterLocation={onEnterCurrentLocation} />
    }
    // An explored node carries its own location card; an unexplored ("?") one is fog-gated
    // (card: null) and falls back to the matching move-target neighbor from gameData
    // .locations — the same object (link card, cost, backend verdict) MovementCard renders.
    const neighbor = mapSelected.visited
      ? null : ((locations ?? []).find(l => l.idLocation === mapSelected.id) ?? null)
    const selected = neighbor ?? mapSelected
    return <MovementCard variant="page" location={selected} viewFromMap={true}
      isNeighbor={neighbor != null || (mapSelected.isNeighbor ?? false)}
      totalEnergyCost={selected.uuid != null && hereLocationId != null
        ? locationCosts[movementCostKey(hereLocationId, selected.uuid)]
        : undefined}
      playerStats={playerStats} story={story}
      matchUuid={matchUuid} accessToken={accessToken}
      onMoved={onMoved} onError={onError} />
  }
  // Step 34 — the backpack. Above the statistics list because it is opened FROM it: it
  // replaces that list rather than living under it. Below the map, which owns the left page
  // and dictates what the right one may show while it is open.
  if (view === 'items') {
    return <ItemsCards playerStats={playerStats} story={story}
      onPreview={onPreview} previewSide="right"
      matchUuid={matchUuid} accessToken={accessToken}
      onDone={onItemUsed} onDropped={onDropped} onError={onError} />
  }
  // Step 36 — the registry, opened from the same (i) list as the backpack and replacing it
  // for exactly the same reason.
  if (view === 'registry') {
    return <RegistryCards registry={gameData?.info?.registry} story={story}
      onPreview={onPreview} previewSide="right" />
  }
  if (view === 'info') {
    return <PageRightInfo story={story} storyFull={storyFull} gameData={gameData}
      playerStats={playerStats} weather={weather} matchUuid={matchUuid} accessToken={accessToken}
      onPreview={onPreview} onSlept={onSlept} onOpenMap={onOpenMap} onOpenItems={onOpenItems}
      onOpenRegistry={onOpenRegistry} onPreviewMatchLog={onPreviewMatchLog} />
  }
  return <PageRightMain story={story} storyFull={storyFull} t={t} gameData={gameData}
    playerStats={playerStats} clock={clock} weather={weather} locations={locations}
    actions={actions} locationCosts={locationCosts} hereLocationId={hereLocationId}
    matchUuid={matchUuid} accessToken={accessToken} endError={endError}
    sleepCardForced={sleepCardForced} onForceSleepCard={onForceSleepCard}
    onPreview={onPreview} onOpenMap={onOpenMap} onOpenItems={onOpenItems}
    onOpenRegistry={onOpenRegistry} onOpenInfo={onOpenInfo}
    onMoved={onMoved} onDone={onDone} onSlept={onSlept}
    onError={onError} onEndGame={onEndGame} onEndGamePreview={onEndGamePreview} />
}

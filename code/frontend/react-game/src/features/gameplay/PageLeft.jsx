import Card from '@/components/layout/Card'
import MapPage from '@/components/layout/Map'
import LocationCard from './cards/LocationCard'
import ComaCard from './cards/ComaCard'
import SadnessCard from './cards/SadnessCard'
import ItemsCard from './cards/ItemsCard'
import RegistryCard from './cards/RegistryCard'
import InformationCard from './cards/InformationCard'
import { bagSummaryProps, registrySummaryProps } from './js/boardProps'

/**
 * PageLeft — the LEFT reading page, in priority order: an open choice-event, an edge
 * state (coma / sadness), the backpack, the map, a left preview, else the board itself
 * (the current location, or the story card as fallback).
 */
export default function PageLeft({
  view, pendingChoices, previewLeft, story, t, playerStats, clock, gameData, matchLocations,
  mapSelected, actualLocationCard, storyCard, loading,
  onCloseChoices, onCloseLeft, onCloseItems, onCloseRegistry, onSelectMapNode, onBack,
}) {
  // Step 31 — an open choice-event: the event card sits here, without an execute button;
  // its back arrow ends the event (and clears the options on the right).
  if (pendingChoices) {
    return <Card variant="page"
      card={{ ...(pendingChoices.card ?? {}),
              title: pendingChoices.card?.title || t('game.choices.title') }}
      entityType="event" loading={false} story={story}
      onClose={onCloseChoices} hidePreview />
  }
  if (previewLeft?.kind === 'coma') {
    return <ComaCard story={story} allPlayers={previewLeft.allPlayers}
      comaEventCard={previewLeft.card} onBack={onCloseLeft} onForward={previewLeft.onForward} />
  }
  if (previewLeft?.kind === 'sad') {
    return <SadnessCard story={story} lifeLost={playerStats?.constitution ?? null}
      onBack={onCloseLeft} onForward={previewLeft.onForward} />
  }
  // Step 34 — the bag owns the left page while it is open, exactly as the map does: the
  // title, the capacity and the way back live here, and the right page is left free for
  // the rows themselves.
  if (view === 'items') {
    return <ItemsCard variant="page" story={story} onClose={onCloseItems}
      {...bagSummaryProps(playerStats)} />
  }
  // Step 36 — the registry owns the left page the same way the bag does: the title and the
  // way back live here, the keys themselves fill the right page.
  if (view === 'registry') {
    return <RegistryCard variant="page" story={story} onClose={onCloseRegistry}
      {...registrySummaryProps(gameData)} />
  }
  // Step 0.28.5 — the world map takes over the left page; its back arrow returns to the board.
  if (view === 'map') {
    return <MapPage gameData={gameData} matchLocations={matchLocations}
      selectedId={mapSelected?.id ?? null}
      onSelectNode={onSelectMapNode} onClose={onBack} />
  }
  if (previewLeft) {
    // v0.35.5 — InformationCard only redresses the 'information' page (story title, no
    // image, one row per badge); every other preview type passes straight to Card.
    return <InformationCard variant="page"
      card={previewLeft.card}
      entity={previewLeft.entity}
      entityType={previewLeft.type}
      loading={false}
      story={story}
      playerStats={playerStats}
      clock={clock}
      onClose={onBack}
      lockedReason={previewLeft.lockedReason}
      statItemsToPageContent={previewLeft.statItemsToPageContent}
      {...previewLeft.additionalProps}
    />
  }
  if (actualLocationCard) {
    return <LocationCard locationsActive={gameData?.info?.locationsActive}
      location={actualLocationCard} card={actualLocationCard} story={story} loading={loading} />
  }
  return storyCard ? <Card variant="page" card={storyCard} loading={false} story={story} /> : null
}

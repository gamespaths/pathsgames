import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import { endMatch } from '../../api/matches'
import Book from '../../components/book/Book'
import CardPreviewModal from '@/components/modals/CardPreviewModal'
import LoadingCard from '@/components/layout/LoadingCard'
import { buildCardCharacteristicsRight } from '@/utils/gamebook'
import EndGameBook from './EndGameBook'
import GameBookMobile from './GameBookMobile'
import PageLeft from './PageLeft'
import PageRight from './PageRight'
import useMatchChrome from './js/useMatchChrome'
import useBookView from './js/useBookView'
import useGameplayResults from './js/useGameplayResults'
import { buildBookmarksLeft, BOOKMARKS_RIGHT } from './js/bookmarks'
import { scrollMobileIntoView } from './js/mobileView'

// Re-exported: these readers were part of this module's surface before they moved to
// @/utils/gameResults, and the board's suite still imports them from here.
export { grantedItemUuids, itemRowForUuid, itemCardForUuid, lastEffectCard } from '@/utils/gameResults'
export { statChangeItems } from '@/utils/statBadges'

/**
 * GameBook — the board: it wires the match payloads to the two reading pages and owns
 * nothing else. The side payloads live in useMatchChrome, what the pages show in
 * useBookView, and what an API answer narrates in useGameplayResults.
 */
export default function GameBook({ gameData, matchUuid, story, storyDetail, onReload, onClose, onError }) {
  const { t, lang } = useTranslation()
  const { user } = useGuestUser()
  const accessToken = user?.accessToken

  const { actualLocationCard, playerStats, locations, actions, endGameCard } = gameData ?? {}
  const storyCard = story?.card ?? null
  // The location the character currently stands on (for the map's "enter" arrow).
  const hereLocationId = gameData?.info?.players?.[0]?.idLocation ?? null
  // The character this client plays: an event with target ALL also changes the stats of the
  // other characters in the location, and those are not this player's badges.
  const playerUuid = gameData?.info?.players?.[0]?.uuid ?? null
  // The loaded detail (with content lists) when available, otherwise the summary prop.
  const storyFull = storyDetail ?? story

  const [gameEnded, setGameEnded] = useState(false)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState(null)
  // The end-game reading page is not wired to an action yet (EndGameCard opens its preview
  // through handleEndGamePreviewFull instead), so the page renders without one.
  const activeAction = null

  const { clock, weather, matchLocations, locationCosts, refresh: refreshChrome } =
    useMatchChrome(matchUuid, accessToken, lang)
  const [view, viewActions] = useBookView()
  const results = useGameplayResults({
    matchUuid, accessToken, lang, t, playerUuid, playerStats, gameData, weather,
    view, viewActions, refreshChrome, onReload, onError,
  })

  // The end-game reading page: the action's own card plus the button that ends the match.
  function handleEndGamePreviewFull({ card, stats = [], props = {} }) {
    viewActions.openPreview({ card, type: 'end game', stats, props, side: 'right' })
  }

  const handleEndGame = async (action) => {
    if (ending) return
    setEnding(true)
    setEndError(null)
    try {
      await endMatch(matchUuid, action?.uuidEvent ?? action?.uuid, accessToken)
      setGameEnded(true)
    } catch (e) {
      setEndError(e?.response?.data?.error || e?.message || 'end-game-failed')
    } finally {
      setEnding(false)
    }
  }

  // The (i) view: the information page on the left, the statistics list on the right.
  function openInformationView() {
    viewActions.openInfo(buildCardCharacteristicsRight(story, playerStats, clock, weather, {
      matchUuid, accessToken,
      // handleSlept, not the bare reload: this path used to drop the sleep response, so a
      // counter that ran out while sleeping from the info card was never shown.
      onSlept: results.handleSlept,
    }))
  }
  // Back to the board itself: the location on the left, the main screen on the right — where
  // every back arrow lands. Deliberately NOT the statistics list, even when the page was
  // opened from there: closing a page returns to the game, not to the menu that led to it.
  function handleBackOrClose() {
    viewActions.closeAll()
  }
  function closeItemsView() {
    viewActions.closeAll()
    scrollMobileIntoView('.book-mobile-left')
  }

  if (gameEnded) {
    return <EndGameBook story={story} endGameCard={endGameCard} onClose={onClose} />
  }

  const leftContent = <PageLeft
    view={view.view} pendingChoices={view.pendingChoices} previewLeft={view.previewLeft}
    story={story} t={t} playerStats={playerStats} clock={clock} gameData={gameData}
    matchLocations={matchLocations} mapSelected={view.mapSelected}
    actualLocationCard={actualLocationCard} storyCard={storyCard} loading={results.loading}
    onCloseChoices={viewActions.closeChoices}
    onCloseLeft={() => viewActions.setPreviewLeft(null)}
    onCloseItems={closeItemsView}
    onSelectMapNode={viewActions.selectMapNode}
    onBack={handleBackOrClose} />

  const rightContent = <PageRight
    view={view.view} previewRight={view.previewRight} pendingChoices={view.pendingChoices}
    counterZero={view.counterZero} sleepCardForced={view.sleepCardForced}
    mapSelected={view.mapSelected}
    story={story} storyFull={storyFull} t={t} gameData={gameData} playerStats={playerStats}
    playerUuid={playerUuid} weather={weather} clock={clock}
    actualLocationCard={actualLocationCard} locations={locations} actions={actions}
    locationCosts={locationCosts} hereLocationId={hereLocationId}
    matchUuid={matchUuid} accessToken={accessToken}
    choiceInFlight={results.choiceInFlight} endError={endError} activeAction={activeAction}
    onPreview={viewActions.openPreview}
    onCloseRight={() => viewActions.setPreviewRight(null)}
    onCloseChoices={viewActions.closeChoices}
    onSelectChoice={results.handleSelectChoice}
    onDismissCounterZero={() => viewActions.setCounterZero(null)}
    onEnterCurrentLocation={handleBackOrClose}
    onMoved={results.handleMovementDone}
    onDone={results.handleEventExecuted}
    onItemUsed={results.handleItemUsed}
    onDropped={results.handleItemDropped}
    onSlept={results.handleSlept}
    onError={onError}
    onOpenMap={viewActions.openMap}
    onOpenItems={viewActions.openItems}
    onOpenInfo={openInformationView}
    onForceSleepCard={viewActions.forceSleepCard}
    onPreviewMatchLog={() => viewActions.setPreviewRight({ kind: 'matchlog' })}
    onEndGame={handleEndGame}
    onEndGamePreview={handleEndGamePreviewFull}
    onExit={onClose} />

  const right = results.loading ? <LoadingCard story={story} /> : rightContent

  return (
    <>
      <Book
        onClose={() => viewActions.setPreviewRight({ kind: 'close' })}
        closeLabel={`${t('game.closeBook')}${story?.title ?? story?.card?.title ? ' ' + (story?.title ?? story?.card?.title) : ''}`}
        left={leftContent}
        right={right}
        bookmarksLeft={buildBookmarksLeft({ t, view: view.view, previewLeft: view.previewLeft,
          playerStats, onBack: handleBackOrClose, onOpenInfo: openInformationView,
          onOpenItems: viewActions.openItems, onOpenMap: viewActions.openMap })}
        bookmarksRight={BOOKMARKS_RIGHT}
        mobile={<GameBookMobile left={leftContent} right={right} endError={endError} />}
      />
      {/* Mobile (i) preview: the big card shown in a Bootstrap modal. */}
      <CardPreviewModal preview={view.previewModal} story={story} />
    </>
  )
}

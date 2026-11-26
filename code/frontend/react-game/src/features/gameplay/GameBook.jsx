import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../i18n/context'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import { endMatch } from '../../api/matches'
import { isStaleMatch } from '../../api/matchVersion'
import Book from '../../components/book/Book'
import LoadingCard from '@/components/layout/LoadingCard'
import ErrorCard from '@/components/layout/ErrorCard'
import { usePolicyBook } from '@/context/PolicyBookContext'
import { useHomeButtonHandler } from '@/context/HomeButtonContext'
import { buildCardCharacteristicsRight } from '@/utils/gamebook'
import { buildUpdateMatchCard } from '@/utils/loadoutCards'
import { useEndGamePages } from './EndGameBook'
import PageLeft from './PageLeft'
import PageRight from './PageRight'
import useMatchChrome from './js/useMatchChrome'
import useBookView from './js/useBookView'
import useMissionsAlert from './js/useMissionsAlert'
import useMissionsCompleted from './js/useMissionsCompleted'
import useGameplayResults from './js/useGameplayResults'
import { buildBookmarksLeft, BOOKMARKS_RIGHT } from './js/bookmarks'
import { scrollMobileIntoView } from './js/mobileView'
import { PlayProvider, usePlayController } from './play/PlayContext'
import { usePreferences } from '@/preferences/PreferencesContext'
import { vibratePlay } from '@/utils/haptics'

// Re-exported: these readers were part of this module's surface before they moved to
// @/utils/gameResults, and the board's suite still imports them from here.
export { grantedItemUuids, itemRowForUuid, itemCardForUuid, lastEffectCard } from '@/utils/gameResults'
export { statChangeItems } from '@/utils/statBadges'

/**
 * GameBook — the board: it wires the match payloads to the two reading pages and owns
 * nothing else. The side payloads live in useMatchChrome, what the pages show in
 * useBookView, and what an API answer narrates in useGameplayResults.
 * v1.13.0 — `error` (a transient API error) takes the right page; the home tab opens the close card first.
 * Step 15 — the played card (PlayContext), the page turns (`turn`, `hold`) and the end game in the same Book.
 * Step 16 — a played card vibrates the phone once, inside the tap (Android; the player's vibration choice).
 */
export default function GameBook({ gameData, matchUuid, story, storyDetail, onReload, onClose, onError, reloadKey = 0,
  openLogKey = 0, staleKey = 0, error = null, onErrorClose }) {
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
  const { effective: prefs } = usePreferences()
  const play = usePlayController({ onPlayStart: () => vibratePlay(prefs.vibration) })
  const endPages = useEndGamePages({ story, endGameCard, missions: gameData?.info?.missions, onHome: onClose })
  const { closePolicyBook } = usePolicyBook()
  // The close card, never straight to the Home: also from an open policy chapter, which gives way.
  useHomeButtonHandler(gameEnded ? null : () => {
    closePolicyBook()
    viewActions.setPreviewRight({ kind: 'close' })
  })
  // A transient error takes the right page: on mobile it is the bottom of the stack.
  useEffect(() => {
    if (error) scrollMobileIntoView('.book-page-right')
  }, [error])
  // Step 15 — the error page comes and goes with a fade: the render that flips it reads the last seen state.
  const errorOn = Boolean(error)
  const errorSeen = useRef(errorOn)
  const errorFlip = errorSeen.current !== errorOn
  useEffect(() => { errorSeen.current = errorOn }, [errorOn])
  // v1.7.0 step 8 — a match refetch (stale or page return) reloads the chrome and closes the pages
  // Step 15 — with no turn, and a hold still on is released with none.
  useEffect(() => {
    if (!reloadKey) return
    refreshChrome()
    viewActions.releaseTurn(null)
    viewActions.closeAll(null)
  }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // v1.8.0 — after a STALE_MATCH refetch (closeAll above runs first) the right page explains it
  useEffect(() => {
    if (!staleKey) return
    viewActions.setPreviewRight({ kind: 'preview', card: buildUpdateMatchCard(t), type: 'updateMatch' })
  }, [staleKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // v1.7.0 step 12 — the "match is being updated" banner opens the match log on the right page
  useEffect(() => {
    if (!openLogKey) return
    viewActions.setPreviewRight({ kind: 'matchlog' })
  }, [openLogKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // v0.37.1 — whether the missions moved since the player last opened them. Watching the
  // pages keeps the mark up to date on its own, so news read as it lands never lights the tab.
  const missionsAlert = useMissionsAlert(gameData?.info?.missions,
    view.view === 'missions' || view.view === 'missionSteps')
  const results = useGameplayResults({
    matchUuid, accessToken, lang, t, playerUuid, playerStats, gameData, weather, clock,
    view, viewActions, refreshChrome, onReload, onError, play: play.api,
  })
  // v0.38.2 — a mission just closed reads on the right page at once, back arrow and all.
  useMissionsCompleted(gameData?.info?.missions, results.showMissionsCompleted)

  // The end-game reading page: the action's own card plus the button that ends the match.
  function handleEndGamePreviewFull({ card, stats = [], props = {} }) {
    viewActions.openPreview({ card, type: 'end game', stats, props, side: 'right' })
  }

  // Step 15 — land, then the end pages and their forward turn in ONE commit (nothing reloads: no hold needed).
  const handleEndGame = async (action) => {
    if (ending) return
    setEnding(true)
    setEndError(null)
    try {
      await endMatch(matchUuid, action?.uuidEvent ?? action?.uuid, accessToken)
      const landing = play.api.land()
      if (landing) await landing
      play.api.end()
      setGameEnded(true)
      endPages.enter()
    } catch (e) {
      play.api.cancel()
      if (!isStaleMatch(e)) setEndError(e?.response?.data?.error || e?.message || 'end-game-failed')
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
  // Step 15 — the bag, registry, missions and training pages close the same way: the back turn lands phones at the top.
  function handleBackOrClose() {
    viewActions.closeAll()
  }
  // v0.37.1 — opening the panel is reading the news: the gold tab goes out here, and nowhere
  // else, so it stays lit until the player has actually looked.
  function openMissionsView() {
    missionsAlert.markSeen()
    viewActions.openMissions()
  }

  const leftContent = <PageLeft
    view={view.view} pendingChoices={view.pendingChoices} previewLeft={view.previewLeft}
    story={story} t={t} playerStats={playerStats} clock={clock} gameData={gameData}
    matchLocations={matchLocations} mapSelected={view.mapSelected}
    actualLocationCard={actualLocationCard} storyCard={storyCard} loading={results.loading}
    onCloseChoices={viewActions.closeChoices}
    onCloseLeft={() => viewActions.setPreviewLeft(null)}
    onCloseItems={handleBackOrClose}
    onCloseRegistry={handleBackOrClose}
    onCloseMissions={handleBackOrClose}
    onCloseMission={viewActions.openMissions}
    onCloseExp={handleBackOrClose}
    onSelectMapNode={viewActions.selectMapNode}
    onBack={handleBackOrClose} />

  const rightContent = <PageRight
    view={view.view} previewRight={view.previewRight} pendingChoices={view.pendingChoices}
    counterZero={view.counterZero} sleepCardForced={view.sleepCardForced}
    mapSelected={view.mapSelected} missionSelected={view.missionSelected}
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
    onExpUsed={results.handleExpUsed}
    onDropped={results.handleItemDropped}
    onSlept={results.handleSlept}
    onError={onError}
    onOpenMap={viewActions.openMap}
    onOpenItems={viewActions.openItems}
    onOpenRegistry={viewActions.openRegistry}
    onOpenMissions={viewActions.openMissions}
    onOpenHistory={() => viewActions.setPreviewRight({ kind: 'matchlog' })}
    onOpenMission={viewActions.openMission}
    onOpenExp={viewActions.openExp}
    onOpenInfo={openInformationView}
    onEndGame={handleEndGame}
    onEndGamePreview={handleEndGamePreviewFull}
    onExit={onClose} />

  // Priority: a transient error, then the reload in progress, then the board's own page.
  const right = error
    ? <ErrorCard status={error.status} message={error.message} onClose={onErrorClose} />
    : results.loading ? <LoadingCard story={story} /> : rightContent

  // Step 15 — ONE Book for the whole match: the end game is a page turn of it, not a second book.
  if (gameEnded) {
    return (
      <PlayProvider controller={play}>
        <Book left={endPages.left} right={endPages.right} wrapperClass={endPages.wrapperClass}
          pageKey={`end:${endPages.pageKey}`} direction={endPages.direction} coverTitle={story?.title} />
      </PlayProvider>
    )
  }
  return (
    <PlayProvider controller={play}>
      <Book
        coverTitle={story?.title}
        left={leftContent}
        right={right}
        bookmarksLeft={buildBookmarksLeft({ t, view: view.view, previewLeft: view.previewLeft,
          playerStats, onBack: handleBackOrClose, onOpenInfo: openInformationView,
          onOpenItems: viewActions.openItems, onOpenMap: viewActions.openMap,
          onOpenMissions: openMissionsView,
          missionsChanged: missionsAlert.changed })}
        bookmarksRight={BOOKMARKS_RIGHT}
        pageKey={`${view.turn.key}:${errorOn ? 'error' : 'board'}`}
        direction={errorFlip ? 'fade' : view.turn.direction}
        holdTurn={view.hold}
      />
    </PlayProvider>
  )
}

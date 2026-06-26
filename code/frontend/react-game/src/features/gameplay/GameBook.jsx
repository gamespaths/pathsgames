import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../i18n/context'
import LocationCard from './cards/LocationCard'
import PlayerStats from './cards/PlayerStats'
import EndGameBook from './EndGameBook'
import GameBookMobile from './GameBookMobile'
import { endMatch, getMatchClock, getMatchWeather, getMatchLocations } from '../../api/matches'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import Book from '../../components/book/Book'
import CardPreviewModal from '@/components/modals/CardPreviewModal'
import Card from '../../components/layout/Card'
import {
  buildCardCharacteristics,
  buildCardCharacteristicsRight,
  storySelectionCount,
  selectedTraitCount,
} from '@/utils/gamebook'
import CloseGameCard from './cards/CloseGameCard'
import GoToSleepCard from './cards/GoToSleepCard'
import MovementCard from './cards/MovementCard'
import WeatherCard from './cards/WeatherCard'
import EndGameCard from './cards/EndGameCard'
import PlayerCards from './cards/PlayerCards'
import BonusBadgeList from '@/components/ui/BonusBadgeList'
import { buildWeatherCard } from '@/utils/loadoutCards'

export default function GameBook({ gameData, matchUuid, story, storyDetail, onReload, onClose, onError }) {//info=
  const { t } = useTranslation()
  const { user } = useGuestUser()

  const { actualLocationCard, playerStats, locations, actions, endGameCard } = gameData ?? {}
  const storyCard = story?.card ?? null

  const [gameEnded, setGameEnded] = useState(false)
  const [closePrompt, setClosePrompt] = useState(false)
  const [statisticsCards, setStatisticsCards] = useState(false)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState(null)
  const [preview, setPreview] = useState(null) // { entity, type } or null
  const [clock, setClock] = useState(null)
  const [weather, setWeather] = useState(null)
  const [previewModal, setPreviewModal] = useState(null)
  // Step 28 — map of neighbor location uuid → totalEnergyCost (edge + entry +
  // weather), loaded from /locations. The neighbor list itself is the /info
  // adapter's `locations`; this only supplies the weather-resolved move cost.
  const [locationCosts, setLocationCosts] = useState({})
  const prevWeatherUuidRef = useRef(null)
  // The `story` prop is the lean summary (no classes/characters/traits/difficulties).
  // The full detail (with content lists) arrives via the `storyDetail` prop, loaded
  // by GamePage; `storyFull` falls back to the summary until the detail arrives.

  // Load the clock cycle state once the match is known, and after each sleep.
  async function refreshClock() {
    if (!matchUuid) return
    try {
      setClock(await getMatchClock(matchUuid, user?.accessToken))
    } catch {
      // Clock is non-critical chrome; leave the previous value on failure.
    }
  }
  useEffect(() => {
    let cancelled = false
    if (!matchUuid) return undefined
    getMatchClock(matchUuid, user?.accessToken)
      .then(c => { if (!cancelled) setClock(c) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [matchUuid, user?.accessToken])

  // Step 27 — load the current weather once the match is known, and after each
  // sleep that advances the clock (a new time unit re-selects the weather).
  async function refreshWeather() {
    if (!matchUuid) return
    try {
      setWeather(await getMatchWeather(matchUuid, user?.accessToken))
    } catch {
      // Weather is non-critical chrome; leave the previous value on failure.
    }
  }
  useEffect(() => {
    let cancelled = false
    if (!matchUuid) return undefined
    getMatchWeather(matchUuid, user?.accessToken)
      .then(w => { if (!cancelled) setWeather(w) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [matchUuid, user?.accessToken])

  // Show the new weather card in the previewModal when the weather UUID changes
  // (skips the initial load where prevWeatherUuidRef is still null).
  useEffect(() => {
    if (!weather) return
    const prevUuid = prevWeatherUuidRef.current
    prevWeatherUuidRef.current = weather.uuid
    if (prevUuid === null || weather.uuid === prevUuid) return
    const card = weather.card ? { ...weather.card } : buildWeatherCard(weather, t)
    if (!card.title) card.title = t('game.weather.title')
    const costItems = weather.costMoveSafeLocation > 0
      ? [{ key: 'energy', value: '+' + weather.costMoveSafeLocation, label: t('game.movement.moveCost') }]
      : []
    setPreviewModal({ card, type: 'weather', statItemsToPageContent: costItems, additionalProps: {} })
    const el = document.getElementById('cardPreviewModal')
    const Modal = window.bootstrap?.Modal
    if (el && Modal) Modal.getOrCreateInstance(el).show()
  }, [weather]) // eslint-disable-line react-hooks/exhaustive-deps

  // Step 28 — load the per-neighbor total energy cost; the weather can change it,
  // so it is refreshed together with the clock/weather after a board reload.
  function buildLocationCosts(payload) {
    const map = {}
    for (const loc of payload?.locations ?? []) {
      for (const n of loc.neighbors ?? []) {
        if (n.uuid != null) map[n.uuid] = n.totalEnergyCost
      }
    }
    return map
  }
  async function refreshLocations() {
    if (!matchUuid) return
    try {
      setLocationCosts(buildLocationCosts(await getMatchLocations(matchUuid, user?.accessToken)))
    } catch {
      // Move costs are non-critical chrome; leave the previous map on failure.
    }
  }
  useEffect(() => {
    let cancelled = false
    if (!matchUuid) return undefined
    getMatchLocations(matchUuid, user?.accessToken)
      .then(p => { if (!cancelled) setLocationCosts(buildLocationCosts(p)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [matchUuid, user?.accessToken])

  function refreshComponents(){
    setPreview(null)
    setPreviewModal(null)
    const el = document.getElementById('cardPreviewModal')
    const Modal = window.bootstrap?.Modal
    if (el && Modal) Modal.getOrCreateInstance(el).hide()  
  }
  function handleReloadClockWeatherAndMatchData() {
    // Sleep may advance the clock (when all characters are done): refresh the
    // clock chrome AND reload the board so stats/energy/location reflect it.
    refreshClock()
    // Step 27 — the clock may have advanced to a new time unit: re-select weather.
    refreshWeather()
    // Step 28 — weather/position changed: refresh the per-neighbor move costs.
    refreshLocations()
    onReload?.()
    handleBackOrClose()
    refreshComponents();
  }
  function handleSelectionPreview(card, type) {
    handleSelectionPreviewFull(card, type, null, null , true);
  }
  function handleSelectionPreviewFull(card, type, lockReason, statistics , showModal=true , additionalProps={}) {
    //console.log("handleSelectionPreviewFull",  statistics);
    const previewData = card ? { card, type, lockedReason: lockReason, statItemsToPageContent: statistics, additionalProps } : null
    // Mobile has no left page, so the (i) lens opens the big card in a modal
    // (same pattern as StartBookModal). Desktop keeps the left-page preview.
    if (!card){ 
      setPreview(null)
      setPreviewModal(null)
      return; //ingore null preview, just close the modal if open
    }
    if (showModal && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches) {
      setPreviewModal(previewData)  
      const el = document.getElementById('cardPreviewModal')
      const Modal = window.bootstrap?.Modal
      if (el && Modal) Modal.getOrCreateInstance(el).show()      
    }else{
      setPreviewModal(null);
      setPreview(previewData)
      const el = document.querySelector('.book-left')
      if (el) {
        el.scrollTo({ top: 0, behavior: 'smooth' })
      }      
    }
  }
  function handleBackOrClose() {
    setPreview(null);
    setStatisticsCards(false);
  }

  const handleEndGame = async (action) => {
    if (ending) return
    setEnding(true)
    setEndError(null)
    try {
      const eventUuid = action?.uuidEvent ?? action?.uuid
      console.log('Ending game with action:', action , user, { eventUuid, matchUuid })
      await endMatch(matchUuid, eventUuid, user?.accessToken)
      setGameEnded(true)
    } catch (e) {
      const apiError = e?.response?.data?.error
      setEndError(apiError || e?.message || 'end-game-failed')
    } finally {
      setEnding(false)
    }
  }

  if (gameEnded) {
    return <EndGameBook story={story} endGameCard={endGameCard} onClose={onClose} />
  }
  //console.log("QUI",storyCard, story);
  //console.log("actualLocationCard", actualLocationCard);

  // The base (non-preview) left content: the current location, or the story
  // card as fallback. On mobile this is what the stacked left shows — the (i)
  // preview opens in a modal instead (see handleSelectionPreviewFull).
  //console.log("preview", preview, "actualLocationCard", actualLocationCard, "storyCard", storyCard);
  const leftContent = preview ? (
      <Card variant="page" 
        card={preview.card} 
        entity={preview.entity}
        entityType={preview.type}
        loading={false}
        story={story}
        onClose={handleBackOrClose}
        lockedReason={preview.lockedReason}
        statItemsToPageContent={preview.statItemsToPageContent}
        {...preview.additionalProps}
      />
    ) : actualLocationCard ? <LocationCard locationsActive={gameData.info.locationsActive} 
        location={actualLocationCard} card={actualLocationCard} story={story} />
    : storyCard && <Card variant="page" card={storyCard} loading={storyCard===undefined} story={story} />

  const cardCharacteristics = buildCardCharacteristics(story, playerStats, clock , weather)
  const cardCharacteristicsRight = buildCardCharacteristicsRight(story, playerStats, clock, weather, {
    matchUuid,
    accessToken: user?.accessToken,
    onSlept: handleReloadClockWeatherAndMatchData,
  })
  // The loaded detail (with content lists) when available, otherwise the summary prop.
  const storyFull = storyDetail ?? story
  //const statistics = buildConfigStatistics(gameData?.playerStats ?? {}, t);

  //console.log("gameData",gameData)
  //console.log("story",story);
  //console.log("storyFull",storyFull);
  //console.log("locations",locations , "actions", actions);
  //console.log("playerStats",playerStats);
  //console.log("a",resolveSelectionEntity(storyFull, playerStats, gameData, 'difficulty'));
  
  const rightContent = 
    statisticsCards ? <div className="config-view-wrap config-view--config">
        <div className="config-cards-area selection-list">
          <GoToSleepCard story={story} storyFull={storyFull} gameData={gameData} playerStats={playerStats} onPreview={handleSelectionPreviewFull}
            matchUuid={matchUuid} accessToken={user?.accessToken} onSlept={handleReloadClockWeatherAndMatchData}/>
          <WeatherCard weather={weather} story={storyFull} onPreview={handleSelectionPreviewFull} />

          <PlayerCards storyFull={storyFull} story={story} playerStats={playerStats}
            gameData={gameData} onPreview={handleSelectionPreviewFull} />
        </div>
      </div>
    : <>
      <div className="config-view-wrap config-view--config">
        <div className="config-cards-area selection-list">
          <Card card={cardCharacteristics} entityType="story"  story={story} flagInformationCard={true}
            onPreview={() => { handleSelectionPreviewFull(cardCharacteristicsRight, 'story', null, [], false); setStatisticsCards(true) } }
            childrenIntoImage={<PlayerStats stats={playerStats} plainFlag={false} className="m-1 display-inline-grid flex-direction-column" />}
          />
          {playerStats?.energy <= 1 && /* to Sleep if enery <=1 */
            <GoToSleepCard story={story} gameData={gameData} playerStats={playerStats} onPreview={handleSelectionPreviewFull}
              matchUuid={matchUuid} accessToken={user?.accessToken} onSlept={handleReloadClockWeatherAndMatchData}/>
          }
          {/* Step 27 — current weather card (in both render points). }
          <WeatherCard weather={weather} story={story} onPreview={handleSelectionPreviewFull} /> {  
          removed (for now) because weathere card is on cardCharacteristics */}

          { /* Step 28 — for every neighbor-location render a move-target card */ }
          { (locations ?? []).map(loc => (
            <MovementCard key={loc.uuid ?? loc.idLocation} location={loc}
              totalEnergyCost={loc.uuid != null ? locationCosts[loc.uuid] : undefined}
              playerStats={playerStats} story={story} onPreview={handleSelectionPreviewFull}
              matchUuid={matchUuid} accessToken={user?.accessToken}
              onMoved={handleReloadClockWeatherAndMatchData} onError={onError} />
          )) }

          { /* for every action in location — end-game events expose an "end game" button */  }
          { (actions ?? []).map( action => {
            if (action.endGame) {
              return <EndGameCard key={action.uuid} story={story} action={action} 
                handleSelectionPreview={handleSelectionPreviewFull} handleEndGame={handleEndGame} />
            } else { /*TODO action card */
              return <Card key={action.uuid} card={action.card} entityType="action" 
                onPreview={() => handleSelectionPreview(action.card, 'action')}
                story={story} flagInformationCard={true} />
            }
          }) }
          <div className="sleep-action-row">
          </div>
        </div>
      </div>
      {endError && (
        <p className="game-error end-game-error">
          <i className="fas fa-exclamation-triangle me-2" />{endError}
        </p>
      )}
    </>
  

  return (
    <>
      <Book
        onClose={() => setClosePrompt(true)}
        closeLabel={`${t('game.closeBook')}${story?.title ?? story?.card?.title ? ' ' + (story?.title ?? story?.card?.title) : ''}`}
        left={leftContent}
        right={rightContent}
        mobile={
          <GameBookMobile left={leftContent} right={rightContent} endError={endError} />
        }
      />
      {/* Mobile (i) preview: the big card shown in a Bootstrap modal. */}
      <CardPreviewModal preview={ previewModal} story={story}
      />
      {/* Close confirmation: the player paused (did not finish) the match. The
          story card carries the message and a button back to the home page. */}
      {closePrompt && (
        <CloseGameCard story={story} onExit={onClose} onDismiss={() => setClosePrompt(false)} />
      )}
    </>
  )
}


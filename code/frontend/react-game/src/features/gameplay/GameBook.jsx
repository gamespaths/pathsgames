import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n/context'
import LocationCard from './cards/LocationCard'
import PlayerStats from './cards/PlayerStats'
import EndGameBook from './EndGameBook'
import GameBookMobile from './GameBookMobile'
import { endMatch, getMatchClock } from '../../api/matches'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import Book from '../../components/book/Book'
import CardPreviewModal from '@/components/modals/CardPreviewModal'
import Card from '../../components/layout/Card'
import {
  buildCardCharacteristics,
  buildCardCharacteristicsRight,
  resolveSelectionEntity,
  storySelectionCount,
  selectedTraitCount,
} from '@/utils/gamebook'
import CloseGameCard from './cards/CloseGameCard'
import GoToSleepCard from './cards/GoToSleepCard'
import EndGameCard from './cards/EndGameCard'

export default function GameBook({ gameData, matchUuid, story, storyDetail, onReload, onClose }) {//info=
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
  const [previewModal, setPreviewModal] = useState(null)
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
    // TODO refresh the weather card if the clock advanced to a new day (or night).
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

  const cardCharacteristics = buildCardCharacteristics(story, playerStats, clock)
  const cardCharacteristicsRight = buildCardCharacteristicsRight(story, playerStats, clock, {
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
          {/* 
            TODO add others card  objects and special actions!
          */}          
          <Card card={resolveSelectionEntity(storyFull, playerStats, gameData, 'class')?.card} entityType="class" story={storyFull} flagInformationCard={true} 
            onPreview={() => handleSelectionPreviewFull(resolveSelectionEntity(storyFull, playerStats, gameData, 'class')?.card, 'class', null, null ,true)} />
          <Card card={resolveSelectionEntity(storyFull, playerStats, gameData, 'character')?.card} entityType="character" onPreview={() => handleSelectionPreviewFull(resolveSelectionEntity(storyFull, playerStats, gameData, 'character')?.card, 'character', null, null , true)} story={storyFull} flagInformationCard={true} />
          {playerStats?.traitUuids?.map((trait, index) => (
            <Card key={trait.uuid} card={resolveSelectionEntity(storyFull, playerStats, gameData, 'trait', index)?.card} entityType="trait" onPreview={() => handleSelectionPreviewFull(resolveSelectionEntity(storyFull, playerStats, gameData, 'trait', index)?.card, 'trait', null, null , true)} story={storyFull} flagInformationCard={true} />
          ))}
          <Card card={resolveSelectionEntity(storyFull, playerStats, gameData, 'difficulty')?.card} entityType="difficulty" onPreview={() => handleSelectionPreviewFull(resolveSelectionEntity(storyFull, playerStats, gameData, 'difficulty')?.card, 'difficulty', null, 
            [{key:'energy',label:t('game.energyEverySleep'),value:resolveSelectionEntity(storyFull, playerStats, gameData, 'difficulty').energy}] , true)} story={storyFull} flagInformationCard={true} />
          <Card card={story.card} entityType="story" onPreview={() => handleSelectionPreviewFull(story.card, 'story', null, null , true)} story={story} flagInformationCard={true} />
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
          { /* TODO wheater here 
          <Card type="story"      value={{ card: story.card }} story={story} flagInformationCard={true} onPreview={handleSelectionPreviewFull} count={0} />
          { /* TODO special card here }
          <Card type="story"      value={{ card: story.card }} story={story} flagInformationCard={true} onPreview={handleSelectionPreviewFull} count={0} />
          { /* TODO for every neighbor-location */  }

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


import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n/context'
import BookPageLeft from '../../components/book/BookPageLeft'
import BookPageRight from '../../components/book/BookPageRight'
import GameCard from '../../components/layout/GameCard'
import LocationCard from './LocationCard'
import PlayerStats from './PlayerStats'
import ActionRow from './ActionRow'
import EndGameBook from './EndGameBook'
import GameBookMobile from './GameBookMobile'
import { endMatch, getMatchClock, sleepCharacter } from '../../api/matches'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import BookPageContent from '../../components/book/BookPageContent'
import Book from '../../components/book/Book'
import { CardPreviewOverlay } from '@/features/start-book/StartBookModal'
import CardPreviewModal from '@/components/modals/CardPreviewModal'
import ConfigCard from '../start-book/ConfigCard'
import { buildCardToSleep, buildStatisticsCard } from '@/utils/loadoutCards'
import { aggregateBonusTotals, buildConfigStatistics } from '@/utils/bonusStats'
import {
  buildCardCharacteristics,
  buildCardCharacteristicsRight,
  resolveSelectionEntity,
  storySelectionCount,
  selectedTraitCount,
} from '@/utils/gamebook'

export default function GameBook({ gameData, matchUuid, story, storyDetail, onReload, onClose }) {//info=
  const { t } = useTranslation()
  const { user } = useGuestUser()

  const { actualLocationCard, playerStats, locations, actions, endGameCard } = gameData ?? {}
  const storyCard = story?.card ?? null

  const [gameEnded, setGameEnded] = useState(false)
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

  function handleSlept() {
    // Sleep may advance the clock (when all characters are done): refresh the
    // clock chrome AND reload the board so stats/energy/location reflect it.
    refreshClock()
    onReload?.()
    handleBackOrClose()
    //TODO new weather card!?!?!
  }
  function handleSelectionPreview(entity, type) {
    handleSelectionPreviewFull(entity, type, null, null , true);
  }
  function handleSelectionPreviewFull(entity, type, lockReason, statistics , showModal=true) {
    //console.log("handleSelectionPreviewFull", { entity, type, lockReason, statistics . showModal});
    const previewData = entity ? { entity, type, lockedReason: lockReason, statItemsToPageContent: statistics } : null
    // Mobile has no left page, so the (i) lens opens the big card in a modal
    // (same pattern as StartBookModal). Desktop keeps the left-page preview.
    if (!entity){ 
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
  const leftContent = preview ? (
      <BookPageContent
        card={preview.entity && preview.entity.card ? preview.entity.card : null}
        entity={preview.entity}
        entityType={preview.type}
        loading={false}
        story={story}
        onClose={handleBackOrClose}
        lockedReason={preview.lockedReason}
        statItemsToPageContent={preview.statItemsToPageContent}
      />
    ) : actualLocationCard ? <LocationCard location={actualLocationCard} card={actualLocationCard} story={story} />
    : storyCard && <BookPageContent card={storyCard} loading={storyCard===undefined} story={story} />

  const cardCharacteristics = buildCardCharacteristics(story, playerStats, clock)
  const cardCharacteristicsRight = buildCardCharacteristicsRight(story, playerStats, clock, {
    matchUuid,
    accessToken: user?.accessToken,
    onSlept: handleSlept,
  })
  // The loaded detail (with content lists) when available, otherwise the summary prop.
  const storyFull = storyDetail ?? story
  //const statistics = buildConfigStatistics(gameData?.playerStats ?? {}, t);

  //console.log("gameData",gameData)
  //console.log("story",story);
  //console.log("storyFull",storyFull);
  //console.log("locations",locations , "actions", actions);
  //console.log("playerStats",playerStats);
  

  const rightContent = 
    statisticsCards ? <div className="config-view-wrap config-view--config">
        <div className="config-cards-area selection-list">
          <GoToSleepCard story={story} playerStats={playerStats} onPreview={handleSelectionPreviewFull}
            matchUuid={matchUuid} accessToken={user?.accessToken} onSlept={handleSlept} />
          <ConfigCard type="story"      value={{ card: story.card }} story={story} flagInformationCard={true} onPreview={handleSelectionPreviewFull} count={0} />
          <ConfigCard type="class"      value={resolveSelectionEntity(storyFull, playerStats, gameData, 'class')}      flagInformationCard={true} story={storyFull} onPreview={handleSelectionPreviewFull} onPagePreview={handleSelectionPreviewFull} count={storySelectionCount(storyFull, 'class')} />
          <ConfigCard type="character"  value={resolveSelectionEntity(storyFull, playerStats, gameData, 'character')}  flagInformationCard={true} story={storyFull} onPreview={handleSelectionPreviewFull} onPagePreview={handleSelectionPreviewFull} count={storySelectionCount(storyFull, 'character')} />
          {playerStats?.traitUuids?.map((trait, index) => (
            <ConfigCard key={trait.uuid} type="trait" value={resolveSelectionEntity(storyFull, playerStats, gameData, 'trait', index)} flagInformationCard={true} story={storyFull} onPreview={handleSelectionPreviewFull} onPagePreview={handleSelectionPreviewFull} count={storySelectionCount(storyFull, 'trait')} selectedCount={selectedTraitCount(playerStats)} />
          ))}
          <ConfigCard type="difficulty" value={resolveSelectionEntity(storyFull, playerStats, gameData, 'difficulty')} flagInformationCard={true} story={storyFull} onPreview={handleSelectionPreviewFull} onPagePreview={handleSelectionPreviewFull} count={storySelectionCount(storyFull, 'difficulty')} />
          {/* 
            TODO add others card 
          */}
        </div>
      </div>
    : <>
      <div className="config-view-wrap config-view--config">
        <div className="config-cards-area selection-list">
          <ConfigCard type="story" value={{ card:cardCharacteristics }} story={story} flagInformationCard={true} 
            childrenIntoImage={<PlayerStats stats={playerStats} plainFlag={false} className="m-1 display-inline-grid flex-direction-column" />} 
            onPreview={() => { handleSelectionPreviewFull ({ card: cardCharacteristicsRight }, 'story' , null , [] , false); setStatisticsCards(true)} }
          />
          { /* TODO wheater here 
          <ConfigCard type="story"      value={{ card: story.card }} story={story} flagInformationCard={true} onPreview={handleSelectionPreviewFull} count={0} />
          { /* TODO special card here }
          <ConfigCard type="story"      value={{ card: story.card }} story={story} flagInformationCard={true} onPreview={handleSelectionPreviewFull} count={0} />
          { /* TODO for every neighbor-location */  }

          { /* for every action in location — end-game events expose an "end game" button */  }
          { (actions ?? []).map( action => {
            if (action.endGame) {
              return <ConfigCard key={action.uuid} type="action" value={{card:action.card}} story={story}
                flagInformationCard={true}
                onPreview={() => handleSelectionPreview(action, 'action')} count={0} 
                onAction={() => handleEndGame(action)}
                actionLabel={t('game.endGame')}
                actionIcon={'fa-flag-checkered'}
                actionOnlyIfPreview={true} 
                actionWithInfo={true}
              />
            } else {
              return <ConfigCard key={action.uuid} type="action" value={{card:action.card}} story={story}
                flagInformationCard={true}
                onPreview={() => handleSelectionPreview(action, 'action')} count={0} />
            }
          }) }

          { /* TODO remove ActionRow and PlayerStats }   DEPRECATED
          <ActionRow type="action" options={[...(locations ?? []), ...(actions ?? [])]} onEndGame={handleEndGame}
            handleSelectionPreview={handleSelectionPreview} /> /**/}
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
        onClose={onClose}
        left={leftContent}
        right={rightContent}
        mobile={
          <GameBookMobile left={leftContent} right={rightContent} endError={endError} />
        }
      />
      {/* Mobile (i) preview: the big card shown in a Bootstrap modal. */}
      <CardPreviewModal preview={ previewModal} story={story} 
      />
    </>
  )
}

/*function EndGameButton({ preview, handleEndGame }) {
  const { t } = useTranslation()
  return <button className="gc-footer__btn m-2 p-2" onClick={() => handleEndGame(preview.entity)}>
              <i className={`fas fa-flag-checkered `} />
              <span className="gc-footer__btn-label">{t('game.endGame')}</span>
            </button>
}*/

function GoToSleepCard({ story, playerStats, onPreview, matchUuid, accessToken, onSlept }) {

  //console.log("GoToSleepCard", playerStats , story , onPreview, playerStats.energy, playerStats.energyMax);
  const { t } = useTranslation()
  const [sleeping, setSleeping] = useState(false)

  // Sleep the caller's character; on success let the parent (GameBook) refresh
  // the clock and reload the board. Backend 409s (ALREADY_SLEEPING /
  // NOT_YOUR_TURN / MATCH_NOT_RUNNING) bubble up via the rejected promise.
  async function handleSleep() {
    if (sleeping || !matchUuid) return
    setSleeping(true)
    try {
      const result = await sleepCharacter(matchUuid, accessToken)
      onSlept?.(result)
    } catch (e) {
      console.error('sleep failed', e?.response?.data?.error || e?.message)
    } finally {
      setSleeping(false)
    }
  }
  //const card=buildStatisticsCard(t('game.sleep'), aggregateBonusTotals(playerStats), 'fa-bed');
  const cardRight=buildCardToSleep(story, playerStats, t);
  const cardLeft={...cardRight};
  const energyObject={energy: playerStats.energy, energyMax: playerStats.energyMax};
  //cardLeft.title=energyBadge ;
  //cardRight.title=<><span className="clock-widget-title">{cardRight.title}</span>{energyBadge}</>
  return <ConfigCard 
    type="sleep"  
    story={story} value={{card:cardLeft}}
    flagInformationCard={true} 
    onAction={handleSleep}
    actionLabel={t('game.sleep.action')}
    actionIcon={'fa-bed'}
    actionOnlyIfPreview={true}
    actionWithInfo={true}
    childrenIntoImage={<PlayerStats stats={energyObject} plainFlag={false} showZeros={false} className="m-1 pl-2 display-inline-grid flex-direction-column" />}

    onPreview={() => { 
      onPreview ({ card: cardRight }, 'sleep' , null, 
      [{key:'energy', value: "" + energyObject.energy + "/" + energyObject.energyMax , label: t(`book.stats.totals.energy`)}]
      , true); 
    }}
    />

}

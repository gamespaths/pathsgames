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
import { endMatch, getMatchClock } from '../../api/matches'
import { getStoryDetail } from '../../api/stories'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import BookPageContent from '../../components/book/BookPageContent'
import Book from '../../components/book/Book'
import { CardPreviewOverlay } from '@/features/start-book/StartBookModal'
import ConfigCard from '../start-book/ConfigCard'
import { buildStatisticsCard } from '@/utils/loadoutCards'
import { aggregateBonusTotals, buildConfigStatistics } from '@/utils/bonusStats'
import {
  buildCardCharacteristics,
  buildCardCharacteristicsLeft,
  resolveSelectionEntity,
  storySelectionCount,
  selectedTraitCount,
} from '@/utils/gamebook'

export default function GameBook({ gameData, matchUuid, story , onClose }) {
  const { t, lang } = useTranslation()
  const { user } = useGuestUser()

  const { startLocation, playerStats, locations, actions, endGameCard } = gameData ?? {}
  const hasLocations = Array.isArray(locations) && locations.length > 0
  const storyCard = story?.card ?? null

  const [gameEnded, setGameEnded] = useState(false)
  const [statisticsCards, setStatisticsCards] = useState(false)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState(null)
  const [preview, setPreview] = useState(null) // { entity, type } or null
  const [clock, setClock] = useState(null)
  // The `story` prop is the lean summary (no classes/characters/traits/difficulties).
  // Load the full detail on mount so the characteristics ConfigCards can resolve
  // the player's selections against the story content lists. We don't replace the
  // prop: `storyFull` falls back to the summary until the detail arrives.
  const [storyDetail, setStoryDetail] = useState(null)

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

  // Fetch the full story detail (with content lists) once the story uuid is known.
  useEffect(() => {
    let cancelled = false
    if (!story?.uuid) return undefined
    getStoryDetail(story.uuid, lang)
      .then(d => { if (!cancelled) setStoryDetail(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [story?.uuid, lang])

  function handleSlept() {
    refreshClock()
  }
  function handleSelectionPreview(entity, type) {
    setPreview(entity ? { entity, type } : null)
  }
  function handleSelectionPreviewFull(entity, type, lockReason, statistics) {
    console.log("handleSelectionPreviewFull", { entity, type, lockReason, statistics })
    setPreview(entity ? { entity, type, lockReason, statistics } : null)
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
    ) : 
    hasLocations ? <LocationCard location={startLocation} />
    : storyCard && <BookPageContent card={storyCard} loading={storyCard===undefined} story={story} />

  const oldStoryCard =<div className="game-location-card-wrap">
      <GameCard
        variant="big"
        card={storyCard}
        icon={storyCard.awesomeIcon ?? 'fas fa-book-open'}
        imageAlt={story?.title ?? ''}
      />
      {/*(story?.description ?? storyCard.description) && (
        <p className="game-loc-desc">{story?.description ?? storyCard.description}</p>
      )*/}
    </div>

  const cardCharacteristics = buildCardCharacteristics(story, playerStats, clock)
  const cardCharacteristicsRight = buildCardCharacteristicsLeft(story, playerStats, clock, {
    matchUuid,
    accessToken: user?.accessToken,
    onSlept: handleSlept,
  })
  // The loaded detail (with content lists) when available, otherwise the summary prop.
  const storyFull = storyDetail ?? story

  //console.log("gameData",gameData)
  //console.log("story",story);
  //console.log("storyFull",storyFull);

  const statistics = buildConfigStatistics(gameData?.playerStats ?? {}, t);

  const rightContent = ending ? <BookPageContent card={endGameCard} loading={storyCard===undefined} story={story} /> 
    : statisticsCards ? <div className="config-view-wrap config-view--config">

      <div className="config-cards-area selection-list">
        <ConfigCard type="story"      value={{ card: story.card }} story={story} flagInformationCard={true} onPreview={handleSelectionPreviewFull} count={0} />
        <ConfigCard type="class"      value={resolveSelectionEntity(storyFull, playerStats, gameData, 'class')}      flagInformationCard={true} story={storyFull} onPreview={handleSelectionPreviewFull} onPagePreview={handleSelectionPreviewFull} count={storySelectionCount(storyFull, 'class')} />
        <ConfigCard type="character"  value={resolveSelectionEntity(storyFull, playerStats, gameData, 'character')}  flagInformationCard={true} story={storyFull} onPreview={handleSelectionPreviewFull} onPagePreview={handleSelectionPreviewFull} count={storySelectionCount(storyFull, 'character')} />
        <ConfigCard type="trait"      value={resolveSelectionEntity(storyFull, playerStats, gameData, 'trait')}      flagInformationCard={true} story={storyFull} onPreview={handleSelectionPreviewFull} onPagePreview={handleSelectionPreviewFull} count={storySelectionCount(storyFull, 'trait')} selectedCount={selectedTraitCount(playerStats)} />
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
            onPreview={() => { handleSelectionPreview ({ card: cardCharacteristicsRight }, 'story'); setStatisticsCards(true)} }
          />
          { /* TODO wheater here */}
          <ConfigCard type="story"      value={{ card: story.card }} story={story} flagInformationCard={true} onPreview={handleSelectionPreviewFull} count={0} />
          { /* TODO special card here */}
          <ConfigCard type="story"      value={{ card: story.card }} story={story} flagInformationCard={true} onPreview={handleSelectionPreviewFull} count={0} />
          { /* TODO for every neighbor-location */  }
          { /* TODO for every action in location */  }

          { /* TODO remove ActionRow and PlayerStats */}
          <ActionRow type="action" options={[...(locations ?? []), ...(actions ?? [])]} onEndGame={handleEndGame}
            handleSelectionPreview={handleSelectionPreview} />
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
    <Book
      onClose={onClose}
      left={leftContent}
      right={rightContent}
      mobile={
        <GameBookMobile gameData={gameData} story={story} onEndGame={handleEndGame} endError={endError}
          clock={clock} matchUuid={matchUuid} accessToken={user?.accessToken} onSlept={handleSlept} />
      }
    />

  )
}

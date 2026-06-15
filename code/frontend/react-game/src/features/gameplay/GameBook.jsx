import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n/context'
import BookPageLeft from '../../components/book/BookPageLeft'
import BookPageRight from '../../components/book/BookPageRight'
import GameCard from '../../components/layout/GameCard'
import LocationCard from './LocationCard'
import PlayerStats from './PlayerStats'
import ActionRow from './ActionRow'
import ClockWidget from './ClockWidget'
import SleepButton from './SleepButton'
import EndGameBook from './EndGameBook'
import GameBookMobile from './GameBookMobile'
import { endMatch, getMatchClock } from '../../api/matches'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import BookPageContent from '../../components/book/BookPageContent'
import Book from '../../components/book/Book'
import { CardPreviewOverlay } from '@/features/start-book/StartBookModal'
import ConfigCard from '../start-book/ConfigCard'
import { buildStatisticsCard } from '@/utils/loadoutCards'
import { aggregateBonusTotals, buildConfigStatistics } from '@/utils/bonusStats'

export default function GameBook({ gameData, matchUuid, story , onClose }) {
  const { t } = useTranslation()
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

  const card1={...story.card};
  card1.title=<ClockWidget clock={clock} className="display-inline-grid display-grid" />;
  card1.urlImage=null;
  card1.awesomeIcon=null;
  card1.description=playerStats?.description ?? '';
  const card1right={...card1};
  card1right.title=<ClockWidget clock={clock} className="display-inline-flex ml-2" title={story?.title} />
  //card1right.linkCopyright=null;
  card1right.description=<>
    <PlayerStats stats={playerStats} plainFlag={true} />
    TODO
    <SleepButton
      matchUuid={matchUuid}
      accessToken={user?.accessToken}
      disabled={clock?.anyCharacterSleeping ?? false}
      onSlept={handleSlept}
    />
  </>
  card1right.descriptionTag=true;

  //console.log("gameData",gameData)
  console.log("story",story);

  const statistics = buildConfigStatistics(gameData?.playerStats ?? {}, t);

  const rightContent = ending ? <BookPageContent card={endGameCard} loading={storyCard===undefined} story={story} /> 
    : statisticsCards ? <div className="config-view-wrap config-view--config">

      <div className="config-cards-area selection-list">
        <ConfigCard type="story"      value={{ card: story.card }} story={story} flagInformationCard={true} onPreview={handleSelectionPreviewFull} count={0} />
        {/* 
        <ConfigCard type="class"      value={config.class}      story={story} onChangeClick={() => onChangeClick('class')}      onPreview={() => onChangeClick('class')}      count={story?.classes?.length}            onPagePreview={onPreview} />
        <ConfigCard type="character"  value={config.character}  story={story} onChangeClick={() => onChangeClick('character')}  onPreview={() => onChangeClick('character')}  count={story?.characterTemplates?.length} onPagePreview={onPreview} />
        <ConfigCard type="bonuses"   value={statisticsCard} flagInformationCard={true} onPreview={onPreview} 
          statistics={statistics.filter(cat => ['dexterity', 'intelligence' , 'constitution' ].includes(cat.key))} />
        <ConfigCard type="trait"      value={selectedTraits[0] ?? null} selectedCount={selectedTraits.length} story={story} onChangeClick={() => onChangeClick('trait')} onPreview={() => onChangeClick('trait')} count={story?.traits?.length} onPagePreview={onPreview} />
        <ConfigCard type="difficulty" value={config.difficulty} story={story} onChangeClick={() => onChangeClick('difficulty')} onPreview={() => onChangeClick('difficulty')} count={story?.difficulties?.length}       onPagePreview={onPreview} />
        <ConfigCard type="bonuses"   value={statisticsCard} flagInformationCard={true} onPreview={onPreview} 
          statistics={statistics .filter(cat => ['life', 'energy' , 'sad', 'weight'].includes(cat.key))} />
        */}
      </div>

      TODO story card character card, class card, difficulty card, traits cards
    </div>
    : <>
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list">
        <ConfigCard type="story" value={{ card:card1 }} story={story} flagInformationCard={true} 
          childrenIntoImage={<PlayerStats stats={playerStats} plainFlag={false} className="m-1 display-inline-grid flex-direction-column display-inline-flex  " />} 
          onPreview={() => { handleSelectionPreview (card1right, 'story'); setStatisticsCards(true)} }
        />



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

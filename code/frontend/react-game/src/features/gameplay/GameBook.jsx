import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import BookPageLeft from '../../components/book/BookPageLeft'
import BookPageRight from '../../components/book/BookPageRight'
import GameCard from '../../components/layout/GameCard'
import LocationCard from './LocationCard'
import PlayerStats from './PlayerStats'
import ActionRow from './ActionRow'
import EndGameBook from './EndGameBook'
import GameBookMobile from './GameBookMobile'
import { endMatch } from '../../api/matches'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import BookPageContent from '../../components/book/BookPageContent'
import Book from '../../components/book/Book'
import { CardPreviewOverlay } from '@/features/start-book/StartBookModal'

export default function GameBook({ gameData, matchUuid, story , onClose }) {
  const { t } = useTranslation()
  const { user } = useGuestUser()

  const { startLocation, playerStats, locations, actions, endGameCard } = gameData ?? {}
  const hasLocations = Array.isArray(locations) && locations.length > 0
  const storyCard = story?.card ?? null

  const [gameEnded, setGameEnded] = useState(false)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState(null)
  const [preview, setPreview] = useState(null) // { entity, type } or null
  function handleSelectionPreview(entity, type) {
    setPreview(entity ? { entity, type } : null)
  }
  function handleBackOrClose() {
    setPreview(null)
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
    <CardPreviewOverlay
      card={preview.entity}
      entity={preview.entity}
      entityType={preview.type}
      story={story}
      onClose={handleBackOrClose}
    />) : 
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

  const rightContent = ending ? <BookPageContent card={endGameCard} loading={storyCard===undefined} story={story} /> : <>
    {/*<h3 className="game-page-title">
      <i className="fas fa-compass me-2" />{t('game.explore')}
    </h3>*/}
    <PlayerStats stats={playerStats} />
    <ActionRow type="action" options={[...(locations ?? []), ...(actions ?? [])]} onEndGame={handleEndGame}
      handleSelectionPreview={handleSelectionPreview} />
    {endError && (
      <p className="end-game-error">
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
        <GameBookMobile gameData={gameData} story={story} onEndGame={handleEndGame} endError={endError} />
      }
    />

  )
}

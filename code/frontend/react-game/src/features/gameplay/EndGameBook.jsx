import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import Book from '../../components/book/Book'
import GameCard from '../../components/layout/GameCard'
import BookPageContent from '../../components/book/BookPageContent'

/**
 * EndGameBook — displayed once the player has triggered the end-game event
 * and the backend has acknowledged with `status: ENDED`.
 *
 * Layout (desktop & tablet): two-page book — story card on the left,
 * end-game card (gameData.endGameCard, derived from the story) on the right. A footer "Close" button
 * navigates back to the home page so the player can pick a new adventure.
 *
 * Mobile view stacks the same two cards vertically.
 */
export default function EndGameBook({ story, endGameCard , onClose}) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleClose = () => navigate('/', { replace: true })

  const storyCard  = story?.card ?? null
  const storyTitle = story?.title ?? story?.card?.title ?? null
  const storyDesc  = story?.description ?? story?.card?.description ?? null

  const closeBtn = (
    <div className="end-game-actions">
      <button className="btn-action" onClick={handleClose}>
        <i className="fas fa-home me-2" />{t('game.endGameClose')}
      </button>
    </div>
  )

  const leftPage = <BookPageContent card={storyCard} loading={storyCard===undefined} story={story} />
  const rightPage = <BookPageContent card={endGameCard} loading={endGameCard===undefined} story={story} />


  const mobileStack = (
    <div className="book-mobile-layout end-game-mobile">
      {storyCard && (
        <div className="book-mobile-story-card">
          {storyCard.urlImage && (
            <img src={storyCard.urlImage} alt={storyTitle ?? ''} className="book-mobile-story-img" />
          )}
          <div className="book-mobile-story-body">
            <h3 className="book-mobile-story-title">{storyTitle}</h3>
            {storyDesc && <p className="book-mobile-story-desc">{storyDesc}</p>}
          </div>
        </div>
      )}
      {endGameCard && (
        <div className="book-mobile-story-card">
          {endGameCard.urlImage && (
            <img src={endGameCard.urlImage} alt={endGameCard.title ?? ''} className="book-mobile-story-img" />
          )}
          <div className="book-mobile-story-body">
            <h3 className="book-mobile-story-title">{endGameCard.title ?? endGameCard.name}</h3>
            {endGameCard.description && (
              <p className="book-mobile-story-desc">{endGameCard.description}</p>
            )}
          </div>
        </div>
      )}
      {closeBtn}
    </div>
  )

  return (
    <Book
      onClose={onClose}
      overlayClass="book-overlay end-game-overlay"
      wrapperClass="book-wrapper end-game-wrapper"
      left={leftPage}
      right={rightPage}
      mobile={mobileStack}
    />
  )
}

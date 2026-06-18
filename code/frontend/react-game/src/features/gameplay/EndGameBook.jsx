import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import Book from '../../components/book/Book'
import Card from '../../components/layout/Card'

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

  // A Bootstrap preview modal (#cardPreviewModal) opened on mobile during play
  // is unmounted when the game ends (GameBook early-returns this screen), but
  // Bootstrap leaves its backdrop on <body>, covering the end screen. Clean up
  // any leftover modal state on mount.
  useEffect(() => {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove())
    document.body.classList.remove('modal-open')
    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('padding-right')
  }, [])

  const handleClose = () => navigate('/', { replace: true })

  const storyCard  = story?.card ?? null

  const closeBtn = (
    <div className="end-game-actions">
      <button className="btn-action" onClick={handleClose}>
        <i className="fas fa-home me-2" />{t('game.endGameClose')}
      </button>
    </div>
  )
  function goToHome(){
    // For now we just reload to home, but we could also navigate with state to show a "Game ended" message or similar
    window.location.href = '/'
  }

  const leftPage = <Card variant="page" card={storyCard} loading={storyCard===undefined} story={story} />
  const rightPage = <Card variant="page" card={endGameCard} loading={endGameCard===undefined} story={story} 
    onAction={() => goToHome()} actionLabel={t('game.endGameClose')} actionIcon='fa-home'
  />


  const mobileStack = (
    <div className="book-mobile-layout end-game-mobile">
      {storyCard && <Card variant="page" card={storyCard} story={story} />}
      {endGameCard && <Card variant="page" card={endGameCard} story={story} />}
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

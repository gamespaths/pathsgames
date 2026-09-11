import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import Book from '../../components/book/Book'
import Card from '../../components/layout/Card'
import GameBookMobile from './GameBookMobile'
import MissionCard from './cards/MissionCard'
import MissionCards from './cards/MissionCards'
import MissionStepsCards from './cards/MissionStepsCards'
import { openMissions } from '@/utils/missions'

/**
 * EndGameBook — displayed once the player has triggered the end-game event
 * and the backend has acknowledged with `status: ENDED`.
 *
 * Two readings, in order. First the MISSIONS, exactly as the board shows them: the missions
 * card on the left, the grid on the right, each mission openable down to its steps. The back
 * arrow of the missions card then turns to the ENDING: story card on the left, end-game card
 * (gameData.endGameCard) on the right with the "Close" action back to the home page.
 *
 * A match with no missions at all skips straight to the ending: an empty grid says nothing.
 *
 * Mobile view stacks the same two pages vertically.
 */
export default function EndGameBook({ story, endGameCard, onClose, missions = [] }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const rows = Array.isArray(missions) ? missions : []

  // 'missions' | 'missionSteps' | 'end'
  const [view, setView] = useState(rows.length ? 'missions' : 'end')
  // The mission opened from the grid: its card reads on the left, its steps on the right.
  const [selected, setSelected] = useState(null)
  // A step (i): the card reads on the right page, in place of the steps.
  const [preview, setPreview] = useState(null)

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

  function openMission({ mission, card, stats = [] }) {
    setPreview(null)
    setSelected({ mission, card, stats })
    setView('missionSteps')
  }
  function openPreview({ card, type }) {
    setPreview(card ? { card, type } : null)
  }
  function backToMissions() {
    setPreview(null)
    setSelected(null)
    setView('missions')
  }

  if (view !== 'end') {
    const leftPage = view === 'missionSteps' && selected
      ? <Card variant="page" card={selected.card} entityType="missions" loading={false}
          story={story} onClose={backToMissions} bonusBadgeShowZeros
          statItemsToPageContent={selected.stats} hidePreview />
      : <MissionCard variant="page" story={story} onClose={() => setView('end')}
          count={openMissions(rows).length} total={rows.length} />
    let rightPage
    if (preview) {
      rightPage = <Card variant="page" card={preview.card} entityType={preview.type}
        loading={false} story={story} onClose={() => setPreview(null)} />
    } else if (view === 'missionSteps' && selected) {
      rightPage = <MissionStepsCards mission={selected.mission} story={story}
        onPreview={openPreview} previewSide="right" />
    } else {
      rightPage = <MissionCards missions={rows} story={story}
        onPreview={openPreview} onOpenMission={openMission} previewSide="right" />
    }

    return (
      <Book
        onClose={onClose}
        overlayClass="book-overlay end-game-overlay"
        wrapperClass="book-wrapper end-game-wrapper"
        left={leftPage}
        right={rightPage}
        mobile={<GameBookMobile left={leftPage} right={rightPage} />}
      />
    )
  }

  const leftPage = <Card variant="page" card={storyCard} loading={storyCard===undefined} story={story} />
  const rightPage = <Card variant="page" card={endGameCard} loading={endGameCard===undefined} story={story} 
    onAction={() => goToHome()} actionLabel={t('game.endGameClose')} actionIcon='fa-home'  entityType="exit"
  />


  const mobileStack = (
    <div className="book-mobile-layout end-game-mobile">
      {endGameCard && <Card variant="page" card={endGameCard} story={story} entityType="exit" />}
      {closeBtn}
      {storyCard && <Card variant="page" card={storyCard} story={story} />}            
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

import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import Book from '../../components/book/Book'
import Card from '../../components/layout/Card'
import MissionCard from './cards/MissionCard'
import MissionCards from './cards/MissionCards'
import MissionStepsCards from './cards/MissionStepsCards'
import { openMissions } from '@/utils/missions'
import useBookTurn from '@/hooks/useBookTurn'

/**
 * useEndGamePages — the pages shown once the player has triggered the end-game event and the
 * backend has acknowledged with `status: ENDED`.
 *
 * Two readings, in order. First the MISSIONS, exactly as the board shows them: the missions
 * card on the left, the grid on the right, each mission openable down to its steps. The back
 * arrow of the missions card then turns to the ENDING: story card on the left, end-game card
 * (gameData.endGameCard) on the right with the "Close" action back to the home page.
 *
 * A match with no missions at all skips straight to the ending: an empty grid says nothing.
 *
 * Step 15 — GameBook shows them in its own Book (`enter` turns forward); back arrows turn back, a step (i) fades.
 * Phones stack the same two pages, the end card on top (v1.14.0). The book's home tab goes home.
 */
export function useEndGamePages({ story, endGameCard, missions = [] }) {
  const { t } = useTranslation()
  const rows = Array.isArray(missions) ? missions : []
  const { pageKey, direction, turnTo } = useBookTurn()

  // 'missions' | 'missionSteps' | 'end'; null until a page is chosen: the missions, or the ending without any
  const [chosen, setView] = useState(null)
  const view = chosen ?? (rows.length ? 'missions' : 'end')
  // The mission opened from the grid: its card reads on the left, its steps on the right.
  const [selected, setSelected] = useState(null)
  // A step (i): the card reads on the right page, in place of the steps.
  const [preview, setPreview] = useState(null)

  const storyCard = story?.card ?? null

  function goToHome() {
    // For now we just reload to home, but we could also navigate with state to show a "Game ended" message or similar
    window.location.href = '/'
  }

  /** The game ended: back to the first reading, with ONE forward turn from the board. */
  function enter() {
    setView(null)
    setSelected(null)
    setPreview(null)
    turnTo('forward')
  }
  function openMission({ mission, card, stats = [] }) {
    setPreview(null)
    setSelected({ mission, card, stats })
    setView('missionSteps')
    turnTo('forward')
  }
  function openPreview({ card, type, stats }) {
    setPreview(card ? { card, type, stats } : null)
    turnTo('fade')
  }
  function closePreview() {
    setPreview(null)
    turnTo('fade')
  }
  function backToMissions() {
    setPreview(null)
    setSelected(null)
    setView('missions')
    turnTo('back')
  }
  function toEnding() {
    setView('end')
    turnTo('back')
  }

  let left
  let right
  if (view !== 'end') {
    left = view === 'missionSteps' && selected
      ? <Card variant="page" card={selected.card} entityType="missions" loading={false}
          story={story} onClose={backToMissions} bonusBadgeShowZeros
          statItemsToPageContent={selected.stats} hidePreview />
      : <MissionCard variant="page" story={story} onClose={toEnding}
          count={openMissions(rows).length} total={rows.length} />
    if (preview) {
      right = <Card variant="page" card={preview.card} entityType={preview.type}
        loading={false} story={story} onClose={closePreview}
        statItemsToPageContent={preview.stats} />
    } else if (view === 'missionSteps' && selected) {
      right = <MissionStepsCards mission={selected.mission} story={story}
        onPreview={openPreview} previewSide="right" />
    } else {
      right = <MissionCards missions={rows} story={story}
        onPreview={openPreview} onOpenMission={openMission} previewSide="right" />
    }
  } else {
    left = <Card variant="page" card={storyCard} loading={storyCard === undefined} story={story} entityType="story" />
    right = <Card variant="page" card={endGameCard} loading={endGameCard === undefined} story={story}
      onAction={() => goToHome()} actionLabel={t('game.endGameClose')} actionIcon='fa-home' entityType="exit" />
  }

  // The ending's wrapper puts the end card on top on phones (mobile.css); the missions keep their order.
  const wrapperClass = view === 'end' ? 'book-wrapper end-game-wrapper' : 'book-wrapper'
  return { left, right, wrapperClass, pageKey, direction, enter }
}

/** EndGameBook — the end-game pages in a Book of their own (GameBook uses the hook in its Book). */
export default function EndGameBook({ story, endGameCard, missions = [] }) {
  const pages = useEndGamePages({ story, endGameCard, missions })
  return (
    <Book
      wrapperClass={pages.wrapperClass}
      left={pages.left}
      right={pages.right}
      pageKey={pages.pageKey}
      direction={pages.direction}
    />
  )
}

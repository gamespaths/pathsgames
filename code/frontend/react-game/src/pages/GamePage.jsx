import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { getGameData } from '../api/game'
import { getStory } from '../api/stories'
import GameBook from '../features/game/GameBook'

export default function GamePage() {
  const { storyId } = useParams()
  const { state } = useLocation()
  const matchUuid = state?.matchUuid ?? null

  const [gameData, setGameData] = useState(null)
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([getGameData(storyId), getStory(storyId)]).then(([gd, st]) => {
      if (cancelled) return
      setGameData(gd)
      setStory(st)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [storyId])

  const gotoHomePage = (message) => {
    // For now we just reload to home, but we could also navigate with state to show a "Game ended" message or similar
    window.location.href = '/'
  }

  return (
    <div className="game-page-wrap">
      {loading ? (
        <div className="game-page-loading">
          <i className="fas fa-spinner fa-spin me-4" />Loading…
        </div>
      ) : (
        <GameBook gameData={gameData} matchUuid={matchUuid} story={story} onClose={() => gotoHomePage(null)} />
      )}
    </div>
  )
}

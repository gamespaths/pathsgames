import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getGameData } from '../api/game'
import GameBook from '../features/game/GameBook'

export default function GamePage() {
  const { storyId } = useParams()
  const [gameData, setGameData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGameData(storyId).then(data => {
      setGameData(data)
      setLoading(false)
    })
  }, [storyId])

  return (
    <div className="game-page-wrap">
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          <i className="fas fa-spinner fa-spin me-2" />Loading…
        </div>
      ) : (
        <GameBook gameData={gameData} />
      )}
    </div>
  )
}

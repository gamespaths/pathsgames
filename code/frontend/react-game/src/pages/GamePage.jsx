import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { getGameData } from '../api/game'
import { matchInfoToGameData } from '../api/matchInfoAdapter'
import { getStory } from '../api/stories'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import GameBook from '../features/gameplay/GameBook'

export default function GamePage() {
  const { storyId } = useParams()
  const { state } = useLocation()
  const matchUuid = state?.matchUuid ?? null
  const { user } = useGuestUser() ?? {}

  const [gameData, setGameData] = useState(null)
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // getGameData returns the /api/match/{uuid}/info payload (real or mock with
    // the same shape); matchInfoToGameData maps it into the GameBook board shape.
    Promise.all([getGameData(matchUuid, user?.accessToken), getStory(storyId)]).then(([info, st]) => {
      if (cancelled) return
      setStory(st)
      setGameData(matchInfoToGameData(info, st))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [storyId, matchUuid, user?.accessToken])

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

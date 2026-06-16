import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { getGameData } from '../api/game'
import { matchInfoToGameData } from '../api/matchInfoAdapter'
import { getStory, getStoryDetail } from '../api/stories'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import { useTranslation } from '../i18n/context'
import GameBook from '../features/gameplay/GameBook'

export default function GamePage() {
  const { storyId } = useParams()
  const { state } = useLocation()
  const matchUuid = state?.matchUuid ?? null
  const { user } = useGuestUser() ?? {}
  const { lang } = useTranslation()
  const { t } = useTranslation()

  const [gameData, setGameData] = useState(null)
  const [story, setStory] = useState(null)
  // The full story detail (with content lists) used by GameBook's characteristics
  // ConfigCards to resolve the player's selections. Loaded once the story uuid is known.
  const [storyDetail, setStoryDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // getGameData returns the /api/match/{uuid}/info payload (real or mock with
    // the same shape); matchInfoToGameData maps it into the GameBook board shape.
    Promise.all([getGameData(matchUuid, user?.accessToken), getStory(storyId)]).then(([info, st]) => {
      if (cancelled) return
      setStory(st)
      setGameData(matchInfoToGameData(info, st , t ))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [storyId, matchUuid, user?.accessToken])

  // Fetch the full story detail (with content lists) once the story uuid is known.
  useEffect(() => {
    let cancelled = false
    if (!story?.uuid) return undefined
    getStoryDetail(story.uuid, lang)
      .then(d => { if (!cancelled) setStoryDetail(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [story?.uuid, lang])

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
        <GameBook gameData={gameData} matchUuid={matchUuid} story={story} storyDetail={storyDetail} 
          onClose={() => gotoHomePage(null)} />
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { getMatchInfo } from '../api/game'
import { matchInfoToGameData } from '../api/matchInfoAdapter'
import { getStory, getStoryDetail } from '../api/stories'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import { useTranslation } from '../i18n/context'
import GameBook from '../features/gameplay/GameBook'
import ErrorCard from '../components/modals/ErrorCard'

export default function GamePage() {
  const { storyId } = useParams()
  const { state } = useLocation()
  const matchUuid = state?.matchUuid ?? null
  const { user } = useGuestUser() ?? {}
  const { lang } = useTranslation()
  const { t } = useTranslation()

  const [gameData, setGameData] = useState(null)
  const [story, setStory] = useState(null)
  const [storyDetail, setStoryDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [matchError, setMatchError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (matchUuid === null || storyId === null) {
      setMatchError({ status: 400 })
      setLoading(false)
      return
    }
    Promise.all([getMatchInfo(matchUuid, user?.accessToken), getStory(storyId)])
      .then(([info, st]) => {
        if (cancelled) return
        setStory(st)
        setGameData(matchInfoToGameData(info, st, t))
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setMatchError({ status: err.status ?? null })
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [storyId, matchUuid, user?.accessToken])

  // Re-fetch the match board after actions that mutate match state (e.g. sleep).
  async function reloadGameData() {
    try {
      const info = await getMatchInfo(matchUuid, user?.accessToken)
      setGameData(matchInfoToGameData(info, story, t))
    } catch {
      // keep existing board state if reload fails
    }
  }

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
      {matchError && (
        <ErrorCard status={matchError.status} onClose={() => gotoHomePage(null)} />
      )}
      {loading ? (
        <div className="game-page-loading">
          <i className="fas fa-spinner fa-spin me-4" />Loading…
        </div>
      ) : !matchError && (
        <GameBook gameData={gameData} matchUuid={matchUuid} story={story} storyDetail={storyDetail}
          onReload={reloadGameData} onClose={() => gotoHomePage(null)} />
      )}
    </div>
  )
}

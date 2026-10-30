import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { getMatchInfo } from '../api/game'
import { matchInfoToGameData } from '../api/matchInfoAdapter'
import { getStory, getStoryDetail } from '../api/stories'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import { useTranslation } from '../i18n/context'
import GameBook from '../features/gameplay/GameBook'
import LoadingCard from '@/components/layout/LoadingCard'
import ErrorCard from '../components/modals/ErrorCard'
import { useServer } from '@/context/ServerContext'
import { STALE_EVENT, getMatchVersion, isStaleMatch } from '@/api/matchVersion'
import useMatchRefetchOnReturn from '@/hooks/useMatchRefetchOnReturn'

/** v1.7.0 step 12 — the match changed elsewhere: this device knew a version and the refetch brought another. */
export function changedElsewhere(before, after) {
  return Boolean(before) && Boolean(after) && before !== after
}

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
  // v1.7.0 step 8 — a refetch after STALE_MATCH or a page return: the chrome reload key;
  // v1.8.0 — staleKey asks the board for the "Refreshing" page on the right
  const [reloadKey, setReloadKey] = useState(0)
  const [staleKey, setStaleKey] = useState(0)
  // v1.7.0 step 12 — the dismissible "match is being updated" banner and the request to open the match log
  const [updatedBanner, setUpdatedBanner] = useState(false)
  const [openLogKey, setOpenLogKey] = useState(0)
  const { matchRefetch } = useServer() ?? {}

  // v0.37.6 — the board load in flight and its inputs: StrictMode re-runs the effect on
  // its second mount, which joins this request instead of asking /info again.
  const boardRequest = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (matchUuid === null || storyId === null) {
      setMatchError({ status: 400 })
      setLoading(false)
      return
    }
    const key = `${matchUuid}|${storyId}|${user?.accessToken}|${lang}`
    if (boardRequest.current?.key !== key) {
      boardRequest.current = {
        key,
        promise: Promise.all([getMatchInfo(matchUuid, user?.accessToken, lang), getStory(storyId, lang)]),
      }
    }
    boardRequest.current.promise
      .then(([info, st]) => {
        if (cancelled) return
        setStory(st)
        //console.log("info", info, "st", st, "t", t);
        setGameData(matchInfoToGameData(info, st, t))
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        boardRequest.current = null // a failed load is not kept: the next run asks again
        setMatchError({ status: err.status ?? null })
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [storyId, matchUuid, user?.accessToken, lang])

  // Re-fetch the match board after actions that mutate match state (e.g. sleep).
  async function reloadGameData() {
    try {
      const info = await getMatchInfo(matchUuid, user?.accessToken, lang)
      setGameData(matchInfoToGameData(info, story, t))
    } catch {
      // keep existing board state if reload fails
    }
  }
  const reloadRef = useRef(reloadGameData)
  reloadRef.current = reloadGameData

  // v1.7.0 step 8 — the board and its chrome again from the server; open choices are not kept
  const refetchMatch = useCallback(() => {
    setReloadKey(k => k + 1)
    return reloadRef.current()
  }, [])

  useEffect(() => {
    const onStale = (event) => {
      const uuid = event?.detail?.matchUuid
      if (uuid && uuid !== matchUuid) return
      setStaleKey(k => k + 1)
      void refetchMatch()
    }
    window.addEventListener(STALE_EVENT, onStale)
    return () => window.removeEventListener(STALE_EVENT, onStale)
  }, [matchUuid, refetchMatch])

  // v1.7.0 step 12 — the banner only when the version moved without a write of this device
  const refetchOnReturn = useCallback(async () => {
    const before = getMatchVersion(matchUuid)
    await refetchMatch()
    if (changedElsewhere(before, getMatchVersion(matchUuid))) setUpdatedBanner(true)
  }, [matchUuid, refetchMatch])

  const openMatchLog = () => {
    setUpdatedBanner(false)
    setOpenLogKey(k => k + 1)
  }

  useMatchRefetchOnReturn(() => { void refetchOnReturn() }, {
    browsers: matchRefetch?.browsers, minHiddenSeconds: matchRefetch?.minHiddenSeconds,
    enabled: Boolean(matchUuid) && !loading,
  })

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

  // Surface an API error raised inside GameBook (e.g. startMovement). `transient`
  // errors are shown over the board and dismissed in place; fatal match-load errors
  // (no transient flag) send the player home on close.
  const handleGameError = (err) => {
    if (isStaleMatch(err)) return // the notice and the refetch already answer it
    setMatchError({
      status: err?.status ?? err?.response?.status ?? null,
      message: err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? null,
      transient: true,
    })
  }

  const handleErrorClose = () => {
    if (matchError?.transient) setMatchError(null)
    else gotoHomePage(null)
  }

  return (
    <div className="game-page-wrap">
      {updatedBanner && (
        <div className="pg-update-banner" role="alert" data-testid="match-updated-banner">
          <span>{t('game.matchUpdating')}</span>
          <button type="button" className="pg-update-banner-link" onClick={openMatchLog}>
            {t('game.matchUpdatedLog')}
          </button>
          <button type="button" className="pg-update-banner-close" aria-label={t('game.matchUpdatedDismiss')}
            onClick={() => setUpdatedBanner(false)}>×</button>
        </div>
      )}
      {matchError && (
        <ErrorCard status={matchError.status} message={matchError.message} onClose={handleErrorClose} maxWidth="400px" />
      )}
      {loading ? (
        <LoadingCard story={story} maxWidth="400px" />
      ) : (!matchError || matchError.transient) && (
        <GameBook gameData={gameData} matchUuid={matchUuid} story={story} storyDetail={storyDetail}
          onReload={reloadGameData} onClose={() => gotoHomePage(null)} onError={handleGameError}
          reloadKey={reloadKey} openLogKey={openLogKey} staleKey={staleKey} />
      )}
    </div>
  )
}

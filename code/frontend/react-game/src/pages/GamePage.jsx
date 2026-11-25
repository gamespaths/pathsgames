import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { getMatchInfo } from '../api/game'
import { listMatches } from '../api/matches'
import { matchInfoToGameData } from '../api/matchInfoAdapter'
import { getStory, getStoryDetail } from '../api/stories'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import { useTranslation } from '../i18n/context'
import GameBook from '../features/gameplay/GameBook'
import Book from '@/components/book/Book'
import Card from '@/components/layout/Card'
import LoadingCard from '@/components/layout/LoadingCard'
import ErrorCard from '@/components/layout/ErrorCard'
import { buildErrorCard } from '@/utils/loadoutCards'
import { findResumableMatch } from '@/utils/matchStatus'
import { useServer } from '@/context/ServerContext'
import { STALE_EVENT, getMatchVersion, isStaleMatch } from '@/api/matchVersion'
import useMatchRefetchOnReturn from '@/hooks/useMatchRefetchOnReturn'

/** v1.7.0 step 12 — the match changed elsewhere: this device knew a version and the refetch brought another. */
export function changedElsewhere(before, after) {
  return Boolean(before) && Boolean(after) && before !== after
}

export default function GamePage() {
  const { storyId } = useParams()
  const { state, pathname } = useLocation()
  const navigate = useNavigate()
  const matchUuid = state?.matchUuid ?? null
  const { user, error: guestError, sessionIdle } = useGuestUser() ?? {}
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

  // v1.13.0 — a direct load has no matchUuid: resume the running match of this story, else the story page.
  const accessToken = user?.accessToken ?? null
  useEffect(() => {
    if (matchUuid) return undefined
    const toStory = () => navigate(`/story/${storyId}`, { replace: true })
    if (!accessToken) {
      if (guestError || sessionIdle) toStory()
      return undefined
    }
    let cancelled = false
    listMatches(accessToken)
      .then(list => {
        if (cancelled) return
        const found = findResumableMatch(list, storyId)
        if (found) navigate(pathname, { replace: true, state: { matchUuid: found.uuid } })
        else toStory()
      })
      .catch(() => { if (!cancelled) toStory() })
    return () => { cancelled = true }
  }, [matchUuid, accessToken, guestError, sessionIdle, storyId, pathname, navigate])

  useEffect(() => {
    if (!matchUuid) return undefined
    let cancelled = false
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
  // errors take the board's right page and are dismissed in place; fatal match-load errors
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

  const banner = updatedBanner && (
    <div className="pg-update-banner" role="alert" data-testid="match-updated-banner">
      <span>{t('game.matchUpdating')}</span>
      <button type="button" className="pg-update-banner-link" onClick={openMatchLog}>
        {t('game.matchUpdatedLog')}
      </button>
      <button type="button" className="pg-update-banner-close" aria-label={t('game.matchUpdatedDismiss')}
        onClick={() => setUpdatedBanner(false)}>×</button>
    </div>
  )

  // v1.13.0 — every state is a Book: the loading card, the fatal error page, then the board.
  if (loading) {
    const left = <LoadingCard story={story} />
    return <>{banner}<Book left={left} right={null} /></>
  }
  if (matchError && !matchError.transient) {
    const left = story?.card
      ? <Card variant="page" card={story.card} story={story} entityType="story" loading={false} />
      : <Card variant="page" card={buildErrorCard(t)} entityType="error" loading={false} />
    const right = <ErrorCard status={matchError.status} message={matchError.message} onClose={handleErrorClose} />
    return <>{banner}<Book left={left} right={right} /></>
  }
  return (
    <>
      {banner}
      <GameBook gameData={gameData} matchUuid={matchUuid} story={story} storyDetail={storyDetail}
        onReload={reloadGameData} onClose={() => gotoHomePage(null)} onError={handleGameError}
        error={matchError} onErrorClose={handleErrorClose}
        reloadKey={reloadKey} openLogKey={openLogKey} staleKey={staleKey} />
    </>
  )
}

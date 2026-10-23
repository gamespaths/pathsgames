import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/i18n/context'
import { listMatches } from '@/api/matches'
import { getStory } from '@/api/stories'
import MatchCard from '@/features/matches/MatchCard'
import LoadingCard from '@/components/layout/LoadingCard'
import { sortMatchesForList } from '@/utils/matchStatus'
import { useGuestUser } from './GuestUserContext'
import UserStatsCard from './UserStatsCard'
import { toEpochMs } from '@/utils/dates'

/**
 * UserMatchesList — fetches the current user's matches and story cards,
 * then renders a scrollable grid of MatchCard items.
 * v1.7.0 step 9 — active first, then last played; the matches the last login cancelled are highlighted once.
 * v1.8.0 — the user's statistics card opens the grid; cancelled and banned matches are always listed.
 */
export default function UserMatchesList({ accessToken, preloadedMatches, onPreviewCard, onOpenHistory, onClose }) {
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const [matches,  setMatches]  = useState([])
  const [storyMap, setStoryMap] = useState({}) // storyUuid → story
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const { highlightedMatchUuids, consumeHighlightedMatches } = useGuestUser() ?? {}
  // Read once at mount: a later open of the list shows no highlight.
  const highlightRef = useRef(null)
  if (highlightRef.current === null) highlightRef.current = new Set(highlightedMatchUuids ?? [])

  useEffect(() => {
    if (highlightRef.current.size > 0) consumeHighlightedMatches?.()
  }, [consumeHighlightedMatches])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    // Reuse the list handed over by the Home (via context) when present — no
    // need to hit `GET /api/matches` again. Otherwise fetch it ourselves.
    const source = Array.isArray(preloadedMatches)
      ? Promise.resolve(preloadedMatches)
      : listMatches(accessToken)

    source
      .then(async list => {
        if (cancelled) return
        const safeList = Array.isArray(list) ? list : []
        setMatches(sortMatchesForList(safeList, toEpochMs))

        const uniqueUuids = [...new Set(safeList.map(m => m.storyUuid).filter(Boolean))]
        const stories = await Promise.all(uniqueUuids.map(uuid => getStory(uuid, lang).catch(() => null)))
        if (cancelled) return
        const map = {}
        uniqueUuids.forEach((uuid, i) => { if (stories[i]) map[uuid] = stories[i] })
        setStoryMap(map)
      })
      .catch(e => { if (!cancelled) setError(e?.message || 'Failed to load matches') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [accessToken, preloadedMatches, lang])

  if (loading) return (
    <LoadingCard story={null} />
  )

  if (error) return (
    <div className="matches-list-state matches-list-error">
      <i className="fas fa-exclamation-circle me-2" />{error}
    </div>
  )

  // v1.8.0 — cancelled and banned matches always listed, no "show cancelled" toggle
  const visible = matches

  return (
    <div className="matches-list-wrap">
      <h3 className="matches-list-title">
        <i className="fas fa-scroll me-2" />{t('matches.title')}
      </h3>

      {/* v1.8.0 — the user's small card always opens the grid, so an empty list needs no text */}
      <div className=" selection-list">
          <UserStatsCard />
          {visible.map(match => (
            <MatchCard
              key={match.uuid}
              match={match}
              story={storyMap[match.storyUuid] ?? null}
              highlighted={highlightRef.current.has(match.uuid)}
              onResume={() => { onClose?.(); navigate(`/play/${match.storyUuid}`, { state: { matchUuid: match.uuid } }) }}
              onPreviewCard={onPreviewCard}
              onHistory={onOpenHistory}
            />
          ))}
      </div>
    </div>
  )
}

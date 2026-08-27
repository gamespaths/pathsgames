import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/i18n/context'
import { listMatches } from '@/api/matches'
import { getStory } from '@/api/stories'
import MatchCard from '@/features/matches/MatchCard'
import LoadingCard from '@/components/layout/LoadingCard'

/**
 * UserMatchesList — fetches the current user's matches and story cards,
 * then renders a scrollable grid of MatchCard items.
 */
export default function UserMatchesList({ accessToken, preloadedMatches, onPreviewCard, onClose }) {
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const [matches,  setMatches]  = useState([])
  const [storyMap, setStoryMap] = useState({}) // storyUuid → story
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

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
        setMatches(safeList)

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

  return (
    <div className="matches-list-wrap">
      <h3 className="matches-list-title">
        <i className="fas fa-scroll me-2" />{t('matches.title')}
      </h3>

      {matches.length === 0 ? (
        <p className="matches-list-empty">{t('matches.noMatches')}</p>
      ) : (
        <div className=" selection-list">
          {matches.map(match => (
            <MatchCard
              key={match.uuid}
              match={match}
              story={storyMap[match.storyUuid] ?? null}
              onResume={() => { onClose?.(); navigate(`/play/${match.storyUuid}`, { state: { matchUuid: match.uuid } }) }}
              onPreviewCard={onPreviewCard}
            />
          ))}
        </div>
      )}
    </div>
  )
}

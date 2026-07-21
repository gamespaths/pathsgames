import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import LoadingCard from '@/components/layout/LoadingCard'
import { getMatchLogs } from '@/api/matches'

/**
 * MatchLogCard — the match history, rendered as a full book reading page.
 *
 * Given a match uuid it calls GET /api/matches/{uuid}/logs (Step 28.7) and shows
 * the timeline as a grid of little Cards, one per entry: the entry's own card
 * supplies the title and the image, the event type is overlaid on the image
 * (`childrenIntoImage`) and the date/time — plus the character that acted, when
 * there is one — sits below it (`extraContent`).
 *
 * CLOCK_ADVANCE entries are filtered out: they carry no card and no actor, so
 * they would only add empty tiles to the timeline.
 *
 * The endpoint is cursor-paginated; "load more" appends the next page. Since
 * v0.30.3 the timeline arrives newest-first (order=desc), so the most recent entry
 * opens the page and "load more" walks back into the past.
 *
 * Used on the book's RIGHT page, next to the story card on the left:
 *   - GuestUserModal — when (i) is clicked on a MatchCard;
 *   - GameBook       — when (i) is clicked on the story card in PlayerCards.
 */

const PAGE_LIMIT = 50

/** Entries of these types are never shown in the timeline. */
const HIDDEN_TYPES = new Set(['CLOCK_ADVANCE'])

// Icon per entry type; mirrors the admin console's TYPE_META.
const TYPE_ICON = {
  WEATHER:       'fa-cloud-sun-rain',
  MOVEMENT:      'fa-person-walking',
  SLEEP:         'fa-bed',
  CLOCK_ADVANCE: 'fa-clock',
  RECOVERY:      'fa-heart',
}

/**
 * Date + time in the reader's locale, so the day/month order follows the
 * language (e.g. 12/07 in it, 7/12 in en) instead of being hardcoded.
 */
export function formatLogDate(timestamp, lang) {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return String(timestamp)
  try {
    return new Intl.DateTimeFormat(lang || 'en', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return d.toISOString()
  }
}

/**
 * One timeline entry as a little Card: the entry's card gives title + image, the
 * event type is overlaid on the image, and the date (with the actor, when the
 * entry has one) goes underneath. Entries with no card of their own (SLEEP,
 * RECOVERY) fall back to the type label and its icon.
 */
function LogEntryCard({ entry, lang, t, onPreview }) {
  const typeLabel = t(`matchLog.types.${entry.type}`)
  const actor = entry.characterName || entry.characterUuid

  return (
    <Card
      variant="little"
      card={entry.card ?? null}
      name={entry.card?.title ?? typeLabel}
      icon={`fas ${TYPE_ICON[entry.type] || 'fa-circle'}`}
      entityType={undefined}
      onPreview={() => onPreview(entry)}
      childrenIntoImage={
        <span className={`match-log-type match-log-type--${entry.type}`}>
          <i className={`fas ${TYPE_ICON[entry.type] || 'fa-circle'} me-1`} />
          {typeLabel}
        </span>
      }
      locked={true} lockedIcon=""
      lockInfo={actor
        ? `${formatLogDate(entry.timestamp, lang)} · ${actor}`
        : formatLogDate(entry.timestamp, lang)}
    />
  )
}

export default function MatchLogCard({ matchUuid, accessToken, story = null, onBack = null }) {
  const { t, lang } = useTranslation()

  const [entries, setEntries]   = useState([])
  const [cursor, setCursor]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]       = useState(null)
  // (i) on an entry tile: that entry's card takes over this page. The back arrow
  // returns to the timeline, which stays loaded underneath.
  const [preview, setPreview]   = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!matchUuid) return undefined

    setLoading(true)
    setError(null)
    getMatchLogs(matchUuid, accessToken, { limit: PAGE_LIMIT, lang })
      .then(page => {
        if (cancelled) return
        setEntries(page?.logs ?? [])
        setCursor(page?.nextCursor ?? null)
      })
      .catch(e => { if (!cancelled) setError(e?.message || true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
    // `t` is intentionally not a dependency: the i18n context rebuilds it on every
    // render, so depending on it would re-run this effect (and refetch) forever.
  }, [matchUuid, accessToken, lang])

  // Returns the promise so Card's action button can await it and show its own
  // in-progress spinner while the next page is loading.
  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return Promise.resolve()
    setLoadingMore(true)
    return getMatchLogs(matchUuid, accessToken, { limit: PAGE_LIMIT, cursor, lang })
      .then(page => {
        setEntries(prev => [...prev, ...(page?.logs ?? [])])
        setCursor(page?.nextCursor ?? null)
      })
      .catch(e => setError(e?.message || true))
      .finally(() => setLoadingMore(false))
  }, [matchUuid, accessToken, cursor, loadingMore, lang])

  // Clock advances carry no card and no actor: they would render as empty tiles.
  const visibleEntries = entries.filter(e => !HIDDEN_TYPES.has(e.type))

  if (loading) return <LoadingCard story={story} />
  const body = (
    <div className="match-log-wrap" data-testid="match-log-card">
      {loading ? (
        // The "please wait" card page (with the story's picture when known);
        // the load-more button below keeps its own inline spinner instead.
        <LoadingCard story={story} />
      ) : error ? (
        <p className="match-log-state match-log-error">
          <i className="fas fa-exclamation-circle me-2" />
          {typeof error === 'string' ? error : t('matchLog.error')}
        </p>
      ) : visibleEntries.length === 0 ? (
        <p className="match-log-state">{t('matchLog.empty')}</p>
      ) : (
        <>
          <div className="match-log-list selection-list">
            {visibleEntries.map((entry, idx) => (
              <LogEntryCard
                key={`${entry.type}-${entry.timestamp}-${idx}`}
                entry={entry} lang={lang} t={t}
                onPreview={setPreview}
              />
            ))}
          </div>

          {/* Load more sits at the end of the list, big and centered. It borrows
              CardButtons' look (gc-footer__btn) so it reads as the same control,
              and shows the same in-progress spinner while the page loads. */}
          {cursor && (
            <div className="match-log-more-wrap">
              <button className="gc-footer__btn match-log-more"
                onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <i className="fas fa-spinner fa-spin me-1" />
                    <span className="gc-footer__btn-label font-size-medium">{t('card.actionInProgress')}</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-angles-down me-1" />
                    <span className="gc-footer__btn-label font-size-medium">{t('matchLog.loadMore')}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* The count is over the entries actually shown, not the raw total, so
              it never contradicts what is on screen (clock advances are hidden). 
            <p className="match-log-count">{visibleEntries.length}</p>    
              */}
          
        </>
      )}
    </div>
  )

  // (i) on an entry: its card takes over the page. Entries with no card of their
  // own (SLEEP, RECOVERY) still get a page built from the type label and icon.
  if (preview) {
    const typeLabel = t(`matchLog.types.${preview.type}`)
    const actor = preview.characterName || preview.characterUuid
    return (
      <Card
        variant="page"
        card={preview.card ?? { title: typeLabel, description: null, urlImage: null }}
        icon={`fas ${TYPE_ICON[preview.type] || 'fa-circle'}`}
        entityType={undefined}
        story={story}
        loading={false}
        onClose={() => setPreview(null)}
        hidePreview
        no_childrenIntoImage={
            <span className={`match-log-type match-log-type--${preview.type}`}>
              <i className={`fas ${TYPE_ICON[preview.type] || 'fa-circle'} me-1`} />
              {typeLabel}
            </span>
        }
        no_extraContent={
          <span className="match-log-when">
            {formatLogDate(preview.timestamp, lang)}
            {actor && <span className="match-log-character"> · {actor}</span>}
          </span>
        }
        extraContentClassName="match-log-entry-extra"
      />
    )
  }

  return (
    <Card
      variant="page"
      card={{ title: t('matchLog.title'), description: null, urlImage: null }}
      entityType="matchlog"
      story={story}
      loading={false}
      onClose={onBack ?? undefined}
      hidePreview
      extraContent={body}
      extraContentClassName="match-log-extra"
    />
  )
}

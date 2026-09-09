import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import LoadingCard from '@/components/layout/LoadingCard'
import { getMatchLogs } from '@/api/matches'
import { buildCardToSleep } from '@/utils/loadoutCards'

/**
 * MatchLogCard — the match history, rendered as a full book reading page.
 *
 * Given a match uuid it calls GET /api/matches/{uuid}/logs (Step 28.7) and shows
 * the timeline as a grid of little Cards, one per entry: the entry's own card
 * supplies the title and the image, the event type is overlaid on the image
 * (`childrenIntoImage`) and the date/time — plus the character that acted, when
 * there is one — sits below it (`extraContent`). SLEEP entries carry no card of
 * their own from the API — `resolveEntryCard` fills in the same static "sleep"
 * card GameBook's own sleep action shows.
 *
 * CLOCK_ADVANCE entries are filtered out: they carry no card and no actor, so
 * they would only add empty tiles to the timeline.
 *
 * v0.35.4 — ITEM_ADD / ITEM_USE / ITEM_DROP entries arrive with the item's own card, and
 * every entry names its actor and what it moved as stat badges, on the tile and on the
 * page the tile opens alike.
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

/** The prefix the backends write in front of a registry change; stripped off in the row. */
const MSG_REGISTRY_CHANGE = 'REGISTRY_CHANGE'

/** Entries of these types are never shown in the timeline. */
const HIDDEN_TYPES = new Set(['CLOCK_ADVANCE'])

// Icon per entry type; mirrors the admin console's TYPE_META.
const TYPE_ICON = {
  WEATHER:         'fa-cloud-sun-rain',
  MOVEMENT:        'fa-walking',
  SLEEP:           'fa-bed',
  CLOCK_ADVANCE:   'fa-clock',
  RECOVERY:        'fa-heart',
  EVENT:           'fa-scroll',
  COUNTER_ZERO:    'fa-hourglass-end',
  AUTOMATIC_EVENT: 'fa-magic',
  // Step 36 / v0.37.2 — both were answered by the API and fell back to the grey default.
  REGISTRY_CHANGE: 'fa-list',
  MISSION_CHANGE:  'fa-clipboard-list',
  ITEM_ADD:        'fa-hand-holding',
  ITEM_USE:        'fa-flask',
  ITEM_DROP:       'fa-trash',
}

/**
 * v0.35.4 — the colour each type's glyph carries as a badge, so the timeline keeps the
 * coding `.match-log-type--*` gave the overlaid label it replaced. Same palette as the
 * admin console's TYPE_META, and it covers the types main.css never got round to
 * (COUNTER_ZERO, AUTOMATIC_EVENT and the three ITEM_*), which fell back to one colour.
 */
const TYPE_COLOR = {
  WEATHER:         '#eab308',
  MOVEMENT:        '#22c55e',
  SLEEP:           '#60a5fa',
  CLOCK_ADVANCE:   '#c084fc',
  RECOVERY:        '#2dd4bf',
  EVENT:           '#f87171',
  COUNTER_ZERO:    '#fb923c',
  AUTOMATIC_EVENT: '#e879f9',
  REGISTRY_CHANGE: '#38bdf8',
  MISSION_CHANGE:  '#d4af37',
  ITEM_ADD:        '#4ade80',
  ITEM_USE:        '#a78bfa',
  ITEM_DROP:       '#9ca3af',
}

/**
 * v0.35.4 — the four resources an entry can move. The API sends two families, `*Cost` and
 * `*Gain`; an ITEM_* entry splits its signed deltas across them, so the same reader covers
 * a move, an event and a potion. `badge` is the BonusBadgeList vocabulary, where coin is
 * plural — the same keys MovementCard already prices a path with.
 */
const RESOURCES = [
  { key: 'energy', badge: 'energy' },
  { key: 'food',   badge: 'food' },
  { key: 'magic',  badge: 'magic' },
  { key: 'coin',   badge: 'coins' },
]

/**
 * The entry as stat badges: what it was, who acted, then what the action took and what it
 * gave. A spend is written with a minus and a gain with a plus, and an event that charged a
 * resource and handed some of it back shows both halves rather than their difference — the
 * two are not the same news.
 *
 * The zeros are dropped HERE rather than left to BonusBadgeList: its own filter parses the
 * value as a number, and the actor badge carries a name, which would never survive it.
 */
export function resourceBadges(entry, t) {
  const items = []
  for (const r of RESOURCES) {
    const spent  = Number(entry?.[`${r.key}Cost`]) || 0
    const gained = Number(entry?.[`${r.key}Gain`]) || 0
    const label  = t(`game.stats.${r.badge}`)
    if (spent)  items.push({ key: r.badge, label, value: spent,  prefix: '−' })
    if (gained) items.push({ key: r.badge, label, value: gained, prefix: '+' })
  }
  return items
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
 * SLEEP entries carry no card of their own from the API. GameBook's own sleep
 * action (GoToSleepCard) shows the static "sleep" card from data/images.json —
 * the match history reuses the very same card, built the same way, so a past
 * sleep entry looks exactly like it did when it happened.
 */
function resolveEntryCard(entry, t) {
  if (entry.type === 'SLEEP') return buildCardToSleep(null, null, t)
  return entry.card ?? null
}

/** What a REGISTRY_CHANGE row says: the key and the two values, without the prefix. */
export function registryDetail(entry, t) {
  const message = (entry?.message ?? '').trim()
  const detail = message.startsWith(MSG_REGISTRY_CHANGE)
    ? message.slice(MSG_REGISTRY_CHANGE.length).trim()
    : message
  return detail || t(`matchLog.types.${entry?.type}`)
}

/**
 * v0.37.2 — one timeline entry as a ROW, not a tile: a history is read down a column, and a
 * grid of pictures made the reader hunt for the order things happened in. What the entry WAS
 * leads as a badge, its card's title names it, and the (i) opens that card as a page — the
 * picture is one click away rather than in the way.
 *
 * A registry write is the exception: it owns no card, so the row says WHAT was written and
 * carries no lens at all — the page behind it would have nothing the row does not already say.
 */
export function LogEntryRow({ entry, lang, t, onPreview }) {
  const typeLabel = t(`matchLog.types.${entry.type}`)
  const registry = entry.type === 'REGISTRY_CHANGE'
  const card = registry ? null : resolveEntryCard(entry, t)
  // An entry with no card of its own (RECOVERY) is named by what it was.
  const title = registry ? registryDetail(entry, t) : (card?.title ?? typeLabel)
  const color = TYPE_COLOR[entry.type]

  return (
    <li className="match-log-row" data-testid="match-log-row">
      <span className="match-log-row__type" style={color ? { color } : undefined}>
        <i className={`fas ${TYPE_ICON[entry.type] || 'fa-circle'} me-1`} />
        {typeLabel}
      </span>
      <span className="match-log-row__title" title={title}>{title}</span>
      {!registry && (
        <button type="button" className="card-info-btn match-log-row__info"
          onClick={() => onPreview(entry)}
          title={t('card.info')} aria-label={`${t('card.info')} ${title}`}>
          <i className="fas fa-info" />
        </button>
      )}
    </li>
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
          <ul className="match-log-list">
            {visibleEntries.map((entry, idx) => (
              <LogEntryRow
                key={`${entry.type}-${entry.timestamp}-${idx}`}
                entry={entry} lang={lang} t={t}
                onPreview={setPreview}
              />
            ))}
          </ul>

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
  // own (RECOVERY) still get a page built from the type label and icon.
  if (preview) {
    const typeLabel = t(`matchLog.types.${preview.type}`)
    const actor = preview.characterName || preview.characterUuid
    return (
      <Card
        variant="page"
        card={resolveEntryCard(preview, t) ?? { title: typeLabel, description: null, urlImage: null }}
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
        // Resources only: the page has room to spell the type and the actor out in words,
        // so badging them here would say each of them twice.
        statItemsToPageContent={resourceBadges(preview, t)}
        bonusBadgeShowZeros
        extraContent={<>
          <span className={`match-log-type match-log-type--${preview.type} float-left`}
            style={TYPE_COLOR[preview.type] ? { color: TYPE_COLOR[preview.type] } : undefined}
          >
            <i className={`fas ${TYPE_ICON[preview.type] || 'fa-circle'} me-1`}
               />
            {typeLabel}
          </span>
          {formatLogDate(preview.timestamp, lang)}
          {actor && <span className="no-match-log-character"> · {actor}</span>}
        </>}
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

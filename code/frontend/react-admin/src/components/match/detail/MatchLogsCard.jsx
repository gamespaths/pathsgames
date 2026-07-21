import { useState } from 'react'
import { fmtDate } from '../MatchDetailModal'
import ErrorAlert from '../../common/ErrorAlert'

/**
 * MatchLogsCard — Step 28.7 consolidated log timeline panel.
 *
 * Shows the entries returned by GET /api/admin/matches/:uuid/logs, rendered as a
 * single table, newest entry first (the API is called with order=desc since
 * v0.30.3). Each entry is colour-coded by type
 * (WEATHER / MOVEMENT / SLEEP / CLOCK_ADVANCE / RECOVERY).
 *
 * v0.28.7 — the endpoint is cursor-paginated: `entries` accumulates the pages
 * loaded so far and "Load more" fetches the next one via `onLoadMore`. WEATHER and
 * MOVEMENT entries carry a resolved `card` (shown as thumbnail + title) and every
 * character-scoped entry names the character that acted.
 *
 * Renders nothing when `entries` is null (admin endpoint not available).
 */

const TYPE_META = {
  WEATHER:       { icon: 'fa-cloud-sun-rain', style: { background: '#3a2e10', color: '#eab308', border: '1px solid #eab308' } },
  MOVEMENT:      { icon: 'fa-person-walking',  style: { background: '#1a3a2a', color: '#22c55e', border: '1px solid #22c55e' } },
  SLEEP:         { icon: 'fa-bed',             style: { background: '#1e3a5f', color: '#60a5fa', border: '1px solid #3b82f6' } },
  CLOCK_ADVANCE: { icon: 'fa-clock',           style: { background: '#2a1a3a', color: '#c084fc', border: '1px solid #a855f7' } },
  RECOVERY:      { icon: 'fa-heart',           style: { background: '#0f2e2e', color: '#2dd4bf', border: '1px solid #14b8a6' } },
}

const DEFAULT_META = { icon: 'fa-circle', style: { background: '#2a2a2a', color: '#9ca3af', border: '1px solid #4b5563' } }

/** Sentinel for "no type filter". */
const ALL = '__ALL__'
const ALL_META = { icon: 'fa-layer-group', style: { background: '#2a2a2a', color: '#d4c4a8', border: '1px solid #6b5b45' } }

/**
 * One count badge in the header, doubling as the filter for its type. The active
 * chip is highlighted; the others are dimmed so the current filter is obvious.
 */
function FilterChip({ label, title, style, icon, active, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      style={{
        ...style,
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        padding: '0.1rem 0.45rem', borderRadius: '0.25rem',
        fontSize: '0.72rem', fontWeight: 600,
        cursor: 'pointer',
        opacity: active ? 1 : 0.55,
        boxShadow: active ? '0 0 0 1px currentColor inset' : 'none',
      }}
    >
      <i className={`fas ${icon}`} />{label}
    </button>
  )
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || DEFAULT_META
  return (
    <span style={{
      ...m.style,
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.18rem 0.55rem', borderRadius: '0.3rem',
      fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <i className={`fas ${m.icon}`} />
      {type}
    </span>
  )
}

/**
 * The entry's card: thumbnail (image, or the card's awesome icon as a fallback)
 * next to its title. Only WEATHER and MOVEMENT entries carry one.
 */
function CardCell({ entry }) {
  const card = entry.card
  if (!card) {
    return <span className="pg-muted">—</span>
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} data-testid="log-card">
      {card.urlImage ? (
        <img
          src={card.urlImage}
          alt={card.title || ''}
          style={{ width: '2.2rem', height: '2.2rem', objectFit: 'cover', borderRadius: '0.25rem', flexShrink: 0 }}
        />
      ) : (
        <span style={{
          width: '2.2rem', height: '2.2rem', borderRadius: '0.25rem', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: '#2a2a2a', color: 'var(--color-ash)',
        }}>
          <i className={`fas ${card.awesomeIcon || 'fa-image'}`} />
        </span>
      )}
      <span style={{ color: 'var(--color-parchment)', whiteSpace: 'nowrap' }}>
        {card.title || <span className="pg-muted">untitled</span>}
      </span>
    </div>
  )
}

/** Who performed the action, when the entry is character-scoped. */
function CharacterCell({ entry }) {
  if (!entry.characterName && !entry.characterUuid) {
    return <span className="pg-muted">—</span>
  }
  return (
    <span title={entry.characterUuid || undefined} style={{ whiteSpace: 'nowrap' }}>
      {entry.characterName || entry.characterUuid}
    </span>
  )
}

function entryDetail(entry) {
  switch (entry.type) {
    case 'WEATHER':
      return entry.idWeather != null ? `weather #${entry.idWeather}` : '—'

    case 'MOVEMENT': {
      const from = entry.idLocationFrom != null ? `#${entry.idLocationFrom}` : '?'
      const to   = entry.idLocationTo   != null ? `#${entry.idLocationTo}`   : '?'
      const cost = entry.energyCost     != null ? ` (${entry.energyCost} ⚡)` : ''
      return `${from} → ${to}${cost}`
    }

    case 'SLEEP':
    case 'CLOCK_ADVANCE':
      return '—'

    case 'RECOVERY':
      return entry.message ? String(entry.message).slice(0, 60) : '—'

    default:
      return '—'
  }
}

// Count how many entries exist per type for the summary header.
function typeCounts(entries) {
  const counts = {}
  for (const e of entries) counts[e.type] = (counts[e.type] || 0) + 1
  return counts
}

export default function MatchLogsCard({
  entries, currentClock, total, nextCursor, loadingMore, onLoadMore, error,
}) {
  // Clicking a type count filters the table down to that type; ALL clears it.
  // The filter is client-side, over the pages loaded so far — it never refetches.
  const [filter, setFilter] = useState(ALL)

  if (error) {
    return <ErrorAlert message={error} />
  }
  if (!entries) return null

  const counts = typeCounts(entries)
  const shown  = entries.length
  const rows   = filter === ALL ? entries : entries.filter(e => e.type === filter)

  return (
    <div
      className="pg-card mb-4"
      style={{ padding: 0, overflow: 'hidden' }}
      data-testid="match-logs-panel"
    >
      {/* Header */}
      <div style={{ padding: '0.75rem 1rem 0.5rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <p className="pg-card-title" style={{ margin: 0 }}>
          <i className="fas fa-scroll me-1" />
          Match log
          <span className="pg-muted" style={{ fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.85rem' }}>
            ({shown} of {total ?? shown} {(total ?? shown) === 1 ? 'entry' : 'entries'} · clock {currentClock})
          </span>
        </p>
        {/* per-type counts, over the entries loaded so far — each one is also the
            filter for that type; "All" clears the filter. */}
        <div
          style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginLeft: '0.5rem' }}
          data-testid="match-logs-filters"
        >
          <FilterChip
            label={`All ${shown}`}
            style={ALL_META.style}
            icon={ALL_META.icon}
            active={filter === ALL}
            onClick={() => setFilter(ALL)}
          />
          {Object.entries(TYPE_META).map(([type, m]) =>
            counts[type] ? (
              <FilterChip
                key={type}
                label={String(counts[type])}
                title={type}
                style={m.style}
                icon={m.icon}
                active={filter === type}
                onClick={() => setFilter(filter === type ? ALL : type)}
              />
            ) : null
          )}
        </div>
      </div>

      {shown === 0 ? (
        <p className="pg-muted" style={{ padding: '0 1rem 0.75rem', fontSize: '0.82rem' }}>
          No log entries yet for this match.
        </p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="pg-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Clock</th>
                  <th>Timestamp</th>
                  <th>Card</th>
                  <th>Character</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry, idx) => (
                  <tr key={`${entry.type}-${entry.timestamp}-${idx}`}>
                    <td style={{ color: 'var(--color-ash)', fontSize: '0.72rem' }}>{idx + 1}</td>
                    <td><TypeBadge type={entry.type} /></td>
                    <td>
                      {entry.clock != null
                        ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{entry.clock}</span>
                        : <span className="pg-muted">—</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {entry.timestamp ? fmtDate(entry.timestamp) : <span className="pg-muted">—</span>}
                    </td>
                    <td><CardCell entry={entry} /></td>
                    <td><CharacterCell entry={entry} /></td>
                    <td
                      title={entry.message || undefined}
                      style={{ color: 'var(--color-parchment)', maxWidth: '20rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {entryDetail(entry)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cursor pagination: the button fetches the next page and appends it. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem' }}>
            <span className="pg-muted" style={{ fontSize: '0.78rem' }}>
              Showing {shown} of {total ?? shown}
              {filter !== ALL && ` — ${rows.length} ${filter}`}
              {nextCursor ? ' — more available' : ' — all loaded'}
            </span>
            <button
              className="pg-btn pg-btn-secondary"
              style={{ fontSize: '0.78rem' }}
              onClick={onLoadMore}
              disabled={loadingMore || !nextCursor}
            >
              {loadingMore ? 'Loading…' : nextCursor ? 'Load more' : 'No more pages'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

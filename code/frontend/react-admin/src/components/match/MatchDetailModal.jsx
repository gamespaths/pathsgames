import { getStory, listEntities } from '../../api/storyApi'
import LoadingSpinner from '../common/LoadingSpinner'
import ErrorAlert from '../common/ErrorAlert'

export const STATUS_BADGE = {
  CREATED:  'pg-badge-info',
  RUNNING:  'pg-badge-success',
  PAUSED:   'pg-badge-gold',
  ENDED:    'pg-badge-gold',
  GAMEOVER: 'pg-badge-danger',
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString()
}

export function shortUuid(uuid) {
  return uuid ? `${uuid.slice(0, 8)}…` : '—'
}

export function StatusBadge({ status }) {
  return <span className={`pg-badge ${STATUS_BADGE[status] || 'pg-badge-info'}`}>{status || '—'}</span>
}

function resolveEntityName(texts, entity) {
  if (!entity) return '—'
  const textId = entity.idTextName
  if (!textId) return '—'
  const text = (texts || []).find(t => Number(t.idText) === Number(textId) && t.lang === 'en')
  return text?.shortText || `#${textId}`
}

function findByUuid(list, uuid) {
  return (list || []).find(e => e.uuid === uuid) || null
}

export async function fetchStoryCtx(storyUuid) {
  if (!storyUuid) return null
  try {
    const [story, texts, difficulties, characters, classes, traits, storyLocations] = await Promise.all([
      getStory(storyUuid),
      listEntities(storyUuid, 'texts'),
      listEntities(storyUuid, 'difficulties'),
      listEntities(storyUuid, 'character-templates'),
      listEntities(storyUuid, 'classes'),
      listEntities(storyUuid, 'traits'),
      listEntities(storyUuid, 'locations'),
    ])
    return { story, texts, difficulties, characters, classes, traits, storyLocations }
  } catch {
    return null
  }
}

export default function MatchDetailModal({ detail, onClose }) {
  const { uuid, loading, info, error, storyCtx } = detail
  const match = info?.match

  const story      = storyCtx?.story || null
  const texts      = storyCtx?.texts || []
  const difficulty = match?.difficultyUuid        ? findByUuid(storyCtx?.difficulties, match.difficultyUuid)        : null
  const character  = match?.characterTemplateUuid ? findByUuid(storyCtx?.characters,   match.characterTemplateUuid) : null
  const matchClass = match?.classUuid             ? findByUuid(storyCtx?.classes,       match.classUuid)             : null
  const traitNames = (match?.traitUuids || []).map(id => {
    const t = findByUuid(storyCtx?.traits, id)
    return t ? resolveEntityName(texts, t) : shortUuid(id)
  })

  const locationTitle = (locUuid) => {
    const loc = findByUuid(storyCtx?.storyLocations, locUuid)
    return loc ? resolveEntityName(texts, loc) : null
  }

  return (
    <div className="pg-modal-backdrop" onClick={onClose}>
      <div className="pg-modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <p className="pg-modal-title">
          <i className="fas fa-gamepad me-2" />
          {match?.name || `Match ${shortUuid(uuid)}`}
        </p>

        {loading && <LoadingSpinner text="Loading match info…" />}
        <ErrorAlert message={error} />

        {!loading && info && (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>

            <p className="pg-card-title mb-2"><i className="fas fa-book me-1" />Story</p>
            <table className="pg-table" style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
              <tbody>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)', whiteSpace: 'nowrap', width: 110 }}>Title</td>
                  <td style={{ fontWeight: 600 }}>{story?.title || <em style={{ color: 'var(--color-ash)' }}>unknown</em>}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)' }}>UUID</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{match?.storyUuid || '—'}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)' }}>Creator</td>
                  <td>{story?.author || story?.creator || <em style={{ color: 'var(--color-ash)' }}>—</em>}</td>
                </tr>
              </tbody>
            </table>

            <p className="pg-card-title mb-2"><i className="fas fa-sliders-h me-1" />Match configuration</p>
            <table className="pg-table" style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
              <tbody>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)', whiteSpace: 'nowrap', width: 110 }}>Status</td>
                  <td><StatusBadge status={match?.status} /></td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)' }}>Mode</td>
                  <td>
                    {match?.singlePlayer === 0
                      ? <span className="pg-badge pg-badge-gold">Multiplayer</span>
                      : <span className="pg-badge pg-badge-info">Single</span>}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)' }}>Clock</td>
                  <td>{match?.currentClock ?? 0}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)' }}>XP Cost</td>
                  <td>{match?.expCost ?? 0}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)' }}>Created</td>
                  <td style={{ fontSize: '0.8rem' }}>{fmtDate(match?.tsInsert)}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)' }}>Difficulty</td>
                  <td>
                    {difficulty
                      ? <><span>{resolveEntityName(texts, difficulty)}</span>{' '}<span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--color-ash)' }}>{shortUuid(match.difficultyUuid)}</span></>
                      : <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }}>{match?.difficultyUuid || '—'}</span>
                    }
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)' }}>Character</td>
                  <td>
                    {character
                      ? <><span>{resolveEntityName(texts, character)}</span>{' '}<span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--color-ash)' }}>{shortUuid(match.characterTemplateUuid)}</span></>
                      : match?.characterTemplateUuid
                        ? <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }}>{match.characterTemplateUuid}</span>
                        : <em style={{ color: 'var(--color-ash)' }}>—</em>
                    }
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)' }}>Class</td>
                  <td>
                    {matchClass
                      ? <><span>{resolveEntityName(texts, matchClass)}</span>{' '}<span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--color-ash)' }}>{shortUuid(match.classUuid)}</span></>
                      : match?.classUuid
                        ? <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-ash)' }}>{match.classUuid}</span>
                        : <em style={{ color: 'var(--color-ash)' }}>—</em>
                    }
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-gold-dark)' }}>Traits</td>
                  <td>
                    {traitNames.length > 0
                      ? traitNames.map((n, i) => <span key={i} className="pg-badge pg-badge-info" style={{ marginRight: 4 }}>{n}</span>)
                      : <em style={{ color: 'var(--color-ash)' }}>—</em>
                    }
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="pg-card-title mb-2">
              <i className="fas fa-map-marker-alt me-1" />
              Current location: {info.currentLocationName || '—'}
            </p>

            <p className="pg-card-title mb-1"><i className="fas fa-map me-1" />Locations ({info.locations?.length ?? 0})</p>
            <table className="pg-table" style={{ fontSize: '0.78rem', marginBottom: '1rem' }}>
              <thead>
                <tr><th>Title</th><th>UUID</th><th>Activated</th><th>Clock</th></tr>
              </thead>
              <tbody>
                {(info.locations ?? []).length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No locations.</td></tr>
                )}
                {(info.locations ?? []).map(l => {
                  const title = locationTitle(l.uuid)
                  return (
                    <tr key={l.uuid ?? l.idLocation}>
                      <td>{title || <em style={{ color: 'var(--color-ash)' }}>#{l.idLocation}</em>}</td>
                      <td style={{ fontFamily: 'monospace' }}>{shortUuid(l.uuid)}</td>
                      <td>{l.flagAlreadyActived ? 'yes' : 'no'}</td>
                      <td>{l.clockCounter ?? 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <p className="pg-card-title mb-1"><i className="fas fa-list me-1" />Registry ({info.registry?.length ?? 0})</p>
            <table className="pg-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr><th>Key</th><th>String value</th><th>Int value</th></tr>
              </thead>
              <tbody>
                {(info.registry ?? []).length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No registry entries.</td></tr>
                )}
                {(info.registry ?? []).map(r => (
                  <tr key={r.uuid ?? r.key}>
                    <td>{r.key}</td>
                    <td style={{ wordBreak: 'break-all' }}>{r.stringValue ?? '—'}</td>
                    <td>{r.intValue ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end mt-3">
          <button className="pg-btn pg-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getMatchInfo, stopMatch, pauseMatch, resumeMatch, deleteMatch } from '../api/matchApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import ConfirmModal from '../components/common/ConfirmModal'
import { fmtDate, shortUuid, StatusBadge, fetchStoryCtx } from '../components/match/MatchDetailModal'

/**
 * MatchDetailPage — Step 21 dedicated admin match details page (/matches/:uuid).
 *
 * Shows match config (difficulty, mode, clock), a match-actions panel (status +
 * stop/pause/resume/delete buttons), players & characters (stats, class, traits),
 * locations and registry. All UUIDs are clickable to copy the full UUID to clipboard.
 */

const TERMINAL = new Set(['ENDED', 'GAMEOVER'])

function findByUuid(list, uuid) {
  return (list || []).find(e => e.uuid === uuid) || null
}

function resolveEntityName(texts, entity) {
  if (!entity) return null
  const textId = entity.idTextName
  if (!textId) return null
  const text = (texts || []).find(t => Number(t.idText) === Number(textId) && t.lang === 'en')
  return text?.shortText || `#${textId}`
}

/** Inline UUID chip — title shows full UUID, click copies it. */
function UuidCopy({ uuid, children }) {
  const [copied, setCopied] = useState(false)

  function handleClick(e) {
    e.stopPropagation()
    if (!uuid) return
    navigator.clipboard?.writeText(uuid).then?.(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  if (!uuid) return <span style={{ color: 'var(--color-ash)' }}>—</span>

  return (
    <span
      title={uuid}
      onClick={handleClick}
      style={{ cursor: 'pointer', fontFamily: children ? 'inherit' : 'monospace' }}
    >
      {children ?? shortUuid(uuid)}
      {copied && (
        <span style={{ color: 'var(--color-gold)', fontSize: '0.72em', marginLeft: '4px' }}>✓</span>
      )}
    </span>
  )
}

function StateBadges({ player }) {
  if (player.isSleeping) return <span className="pg-badge pg-badge-info">sleeping</span>
  if (player.isComa) return <span className="pg-badge pg-badge-danger">coma</span>
  return <span className="pg-badge pg-badge-success">active</span>
}

const STATUS_COLOR = {
  CREATED:  { bg: '#1e3a5f', border: '#3b82f6', label: 'var(--color-parchment)' },
  RUNNING:  { bg: '#1a3a2a', border: '#22c55e', label: 'var(--color-parchment)' },
  PAUSED:   { bg: '#3a2e10', border: '#eab308', label: 'var(--color-parchment)' },
  ENDED:    { bg: '#3a1a1a', border: '#ef4444', label: 'var(--color-parchment)' },
  GAMEOVER: { bg: '#2a0a0a', border: '#7f1d1d', label: 'var(--color-ash)'      },
}

export default function MatchDetailPage() {
  const { uuid } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [info, setInfo]               = useState(null)
  const [storyCtx, setStoryCtx]       = useState(null)

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError]     = useState('')
  const [confirm, setConfirm]             = useState(null) // { title, message, onConfirm }

  const loadInfo = useCallback(() => {
    setLoading(true)
    setError('')
    getMatchInfo(uuid)
      .then(async (data) => {
        setInfo(data)
        const ctx = await fetchStoryCtx(data?.match?.storyUuid)
        setStoryCtx(ctx)
      })
      .catch(e => setError(e.response?.data?.message || e.message || 'Failed to load match'))
      .finally(() => setLoading(false))
  }, [uuid])

  useEffect(() => { loadInfo() }, [loadInfo])

  const match   = info?.match
  const status  = match?.status ?? ''
  const isTerminalStatus = TERMINAL.has(status)
  const texts   = storyCtx?.texts || []
  const players = info?.players || []

  const resolveName = (list, entityUuid) => {
    const entity = findByUuid(list, entityUuid)
    return resolveEntityName(texts, entity)
  }
  const templateName   = u => resolveName(storyCtx?.characters,   u) || (u ? shortUuid(u) : '—')
  const className      = u => resolveName(storyCtx?.classes,      u) || (u ? shortUuid(u) : '—')
  const difficultyName = u => resolveName(storyCtx?.difficulties, u) || (u ? shortUuid(u) : '—')
  const traitName      = u => resolveName(storyCtx?.traits,       u) || (u ? shortUuid(u) : u)

  async function runAction(fn, navigateAfter) {
    setActionLoading(true)
    setActionError('')
    try {
      await fn()
      if (navigateAfter) {
        navigate('/matches')
      } else {
        loadInfo()
      }
    } catch (e) {
      setActionError(e.response?.data?.message || e.message || 'Action failed')
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  function handlePause()  { runAction(() => pauseMatch(uuid),  false) }
  function handleResume() { runAction(() => resumeMatch(uuid), false) }

  function handleStop() {
    setConfirm({
      title: 'Stop match',
      message: `Set match "${match?.name || shortUuid(uuid)}" status to ENDED? Players will no longer be able to continue.`,
      onConfirm: () => runAction(() => stopMatch(uuid), false),
    })
  }

  function handleDelete() {
    setConfirm({
      title: 'Delete match',
      message: `Permanently delete match "${match?.name || shortUuid(uuid)}" and all its data? This cannot be undone.`,
      onConfirm: () => runAction(() => deleteMatch(uuid), true),
    })
  }

  const colors = STATUS_COLOR[status] || STATUS_COLOR.CREATED

  return (
    <div>
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          danger
        />
      )}

      <div className="flex items-center gap-3 mb-4">
        <button className="pg-btn pg-btn-ghost" onClick={() => navigate('/matches')}>
          <i className="fas fa-arrow-left" /> Matches
        </button>
        <h2 className="pg-page-title" style={{ margin: 0 }}>
          <i className="fas fa-gamepad" />
          {match?.name || `Match ${shortUuid(uuid)}`}
        </h2>
        {match && <StatusBadge status={match.status} />}
      </div>

      <ErrorAlert message={error} onClose={() => setError('')} />

      {loading ? (
        <LoadingSpinner text="Loading match…" />
      ) : info && (
        <>
          {/* Match actions panel */}
          <div
            className="pg-card mb-4"
            style={{
              borderLeft: `4px solid ${colors.border}`,
              background: colors.bg,
            }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div style={{ flex: 1 }}>
                <p className="pg-card-title mb-1" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                  <i className="fas fa-circle-notch me-1" />Match status
                </p>
                <span
                  data-testid="match-status-label"
                  style={{
                    fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.05em',
                    color: colors.border,
                  }}
                >
                  {status || '—'}
                </span>
              </div>

              {actionError && (
                <span style={{ color: '#ef4444', fontSize: '0.82rem', flex: '1 1 100%' }}>
                  <i className="fas fa-exclamation-circle me-1" />{actionError}
                </span>
              )}

              <div className="flex gap-2 flex-wrap" style={{ flexShrink: 0 }}>
                {/* Pause — only when RUNNING */}
                {status === 'RUNNING' && (
                  <button
                    className="pg-btn pg-btn-gold"
                    disabled={actionLoading}
                    onClick={handlePause}
                  >
                    <i className="fas fa-pause me-1" />Pause
                  </button>
                )}

                {/* Resume — only when PAUSED */}
                {status === 'PAUSED' && (
                  <button
                    className="pg-btn pg-btn-success"
                    disabled={actionLoading}
                    onClick={handleResume}
                  >
                    <i className="fas fa-play me-1" />Resume
                  </button>
                )}

                {/* Stop — when not yet terminal */}
                {!isTerminalStatus && (
                  <button
                    className="pg-btn pg-btn-danger"
                    disabled={actionLoading}
                    onClick={handleStop}
                  >
                    <i className="fas fa-stop me-1" />Stop match
                  </button>
                )}

                {/* Delete — only when terminal */}
                {isTerminalStatus && (
                  <button
                    className="pg-btn pg-btn-danger"
                    disabled={actionLoading}
                    onClick={handleDelete}
                  >
                    <i className="fas fa-trash me-1" />Delete match
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Match configuration */}
          <div className="pg-card mb-4">
            <p className="pg-card-title mb-2"><i className="fas fa-sliders-h me-1" />Match configuration</p>
            <table className="pg-table" style={{ fontSize: '0.82rem' }}>
              <tbody>
                <tr>
                  <th scope="row">Match UUID</th>
                  <td><UuidCopy uuid={match?.uuid}>{match?.uuid}</UuidCopy></td>
                </tr>
                <tr>
                  <th scope="row">Story UUID</th>
                  <td><UuidCopy uuid={match?.storyUuid}>{match?.storyUuid || '—'}</UuidCopy></td>
                </tr>
                <tr>
                  <th scope="row">Difficulty</th>
                  <td>
                    <UuidCopy uuid={match?.difficultyUuid}>
                      {difficultyName(match?.difficultyUuid)}
                    </UuidCopy>
                  </td>
                </tr>
                <tr><th scope="row">Mode</th><td>{match?.singlePlayer === 0 ? 'Multiplayer' : 'Single'}</td></tr>
                <tr><th scope="row">Clock</th><td>{match?.currentClock ?? 0}</td></tr>
                <tr><th scope="row">XP Cost</th><td>{match?.expCost ?? 0}</td></tr>
                <tr><th scope="row">Created</th><td>{fmtDate(match?.tsInsert)}</td></tr>
                <tr><th scope="row">Current location</th><td>{info.currentLocationName || '—'}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Players & characters */}
          <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
            <p className="pg-card-title" style={{ padding: '0.75rem 1rem 0' }}>
              <i className="fas fa-users me-1" />Players &amp; characters ({players.length})
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="pg-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Character</th><th>User</th>
                    <th>Class</th><th>Traits</th>
                    <th>DEX</th><th>INT</th><th>CON</th>
                    <th>Energy</th><th>Life</th><th>Sad</th>
                    <th>Position</th><th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 && (
                    <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>
                      No characters have joined this match yet.
                    </td></tr>
                  )}
                  {players.map(p => (
                    <tr key={p.uuid}>
                      <td>
                        <UuidCopy uuid={p.characterTemplateUuid}>
                          {templateName(p.characterTemplateUuid)}
                        </UuidCopy>
                      </td>
                      <td>
                        <UuidCopy uuid={p.userUuid}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{shortUuid(p.userUuid)}</span>
                        </UuidCopy>
                      </td>
                      <td>
                        {p.classUuid
                          ? <UuidCopy uuid={p.classUuid}>{className(p.classUuid)}</UuidCopy>
                          : '—'}
                      </td>
                      <td>
                        {(p.traitUuids?.length > 0)
                          ? (
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                              {p.traitUuids.map(t => (
                                <li key={t} style={{ whiteSpace: 'nowrap' }}>
                                  <UuidCopy uuid={t}>{traitName(t)}</UuidCopy>
                                </li>
                              ))}
                            </ul>
                          )
                          : '—'}
                      </td>
                      <td>{p.dexterity}</td>
                      <td>{p.intelligence}</td>
                      <td>{p.constitution}</td>
                      <td>{p.energy}</td>
                      <td>{p.life}</td>
                      <td>{p.sad}</td>
                      <td>{p.locationName || (p.idLocation != null ? `#${p.idLocation}` : '—')}</td>
                      <td><StateBadges player={p} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Locations */}
          <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
            <p className="pg-card-title" style={{ padding: '0.75rem 1rem 0' }}>
              <i className="fas fa-map me-1" />Locations ({info.locations?.length ?? 0})
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="pg-table" style={{ fontSize: '0.78rem' }}>
                <thead><tr><th>UUID</th><th>Id</th><th>Activated</th><th>Clock</th></tr></thead>
                <tbody>
                  {(info.locations ?? []).length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No locations.</td></tr>
                  )}
                  {(info.locations ?? []).map(l => (
                    <tr key={l.uuid ?? l.idLocation}>
                      <td><UuidCopy uuid={l.uuid} /></td>
                      <td>#{l.idLocation}</td>
                      <td>{l.flagAlreadyActived ? 'yes' : 'no'}</td>
                      <td>{l.clockCounter ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Registry */}
          <div className="pg-card" style={{ padding: 0, overflow: 'hidden' }}>
            <p className="pg-card-title" style={{ padding: '0.75rem 1rem 0' }}>
              <i className="fas fa-list me-1" />Registry ({info.registry?.length ?? 0})
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="pg-table" style={{ fontSize: '0.78rem' }}>
                <thead><tr><th>Key</th><th>String value</th><th>Int value</th></tr></thead>
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
          </div>
        </>
      )}
    </div>
  )
}

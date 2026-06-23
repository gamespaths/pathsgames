import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getMatchInfo, getMatchClock, stopMatch, pauseMatch, resumeMatch, deleteMatch, changePlayerStatistics } from '../api/matchApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import ConfirmModal from '../components/common/ConfirmModal'
import { fmtDate, shortUuid, StatusBadge, fetchStoryCtx } from '../components/match/MatchDetailModal'
import TurnOrderPanel from '../components/match/TurnOrderPanel'

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

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick(e)
    }
  }

  if (!uuid) return <span style={{ color: 'var(--color-ash)' }}>—</span>

  return (
    <span
      role="button"
      tabIndex={0}
      title={uuid}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
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

const STATS_FIELDS = [
  { key: 'dex',    label: 'DEX',    hint: null },
  { key: 'intel',  label: 'INT',    hint: null },
  { key: 'con',    label: 'CON',    hint: null },
  { key: 'energy', label: 'Energy', hint: 'energyMax' },
  { key: 'life',   label: 'Life',   hint: 'lifeMax' },
  { key: 'sad',    label: 'Sad',    hint: 'sadMax' },
  { key: 'coin',   label: 'Coin',   hint: null },
  { key: 'food',   label: 'Food',   hint: null },
  { key: 'magic',  label: 'Magic',  hint: null },
]

const PLAYER_FIELD_MAP = { dex: 'dexterity', intel: 'intelligence', con: 'constitution' }

function EditStatsModal({ matchUuid, player, onClose, onSaved }) {
  const [vals, setVals] = useState(() => {
    const init = {}
    STATS_FIELDS.forEach(f => {
      const src = PLAYER_FIELD_MAP[f.key] || f.key
      init[f.key] = String(player[src] ?? player[f.key] ?? '')
    })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function handleSave() {
    setSaving(true)
    setErr('')
    const body = {}
    STATS_FIELDS.forEach(f => {
      const raw = vals[f.key]
      const n = raw === '' ? -1 : parseInt(raw, 10)
      body[f.key] = isNaN(n) ? -1 : n
    })
    changePlayerStatistics(matchUuid, player.uuid, body)
      .then(() => { onSaved(); onClose() })
      .catch(e => setErr(e.response?.data?.message || e.message || 'Save failed'))
      .finally(() => setSaving(false))
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
    >
      <div className="pg-card" style={{ minWidth: 360, maxWidth: 480, width: '90%' }}>
        <p className="pg-card-title" style={{ marginBottom: '0.75rem' }}>
          <i className="fas fa-sliders-h me-2" />Edit statistics
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-ash)', marginBottom: '0.75rem' }}>
          Leave blank or enter -1 to keep the current value.
          Energy, Life and Sad are capped at their max.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem 1rem' }}>
          {STATS_FIELDS.map(f => {
            const src = PLAYER_FIELD_MAP[f.key] || f.key
            const cur = player[src] ?? player[f.key]
            const maxVal = f.hint ? player[f.hint] : null
            return (
              <div key={f.key}>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-ash)', display: 'block' }}>
                  {f.label}
                  {maxVal != null && (
                    <span style={{ marginLeft: 4, color: 'var(--color-gold)' }}>/{maxVal}</span>
                  )}
                </label>
                <input
                  type="number"
                  className="pg-input"
                  style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
                  placeholder={cur != null ? String(cur) : ''}
                  value={vals[f.key]}
                  onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            )
          })}
        </div>
        {err && (
          <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{err}</p>
        )}
        <div className="flex gap-2" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
          <button className="pg-btn pg-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="pg-btn pg-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
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
  const [clock, setClock]             = useState(null)

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError]     = useState('')
  const [confirm, setConfirm]             = useState(null) // { title, message, onConfirm }
  const [statsModal, setStatsModal]       = useState(null) // player object being edited

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
    // Clock state is non-critical chrome and lives behind a newer admin endpoint;
    // tolerate its absence (older backends) by hiding the panel rather than erroring.
    getMatchClock(uuid)
      .then(setClock)
      .catch(() => setClock(null))
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

  // Resolve a clock character (instance uuid) to its template name via the players list.
  const clockCharName = (characterUuid) => {
    const player = players.find(p => p.uuid === characterUuid)
    return player ? templateName(player.characterTemplateUuid) : shortUuid(characterUuid)
  }
  // Story clock label: singular at clock 1, plural otherwise (no label → blank).
  const clockLabel = (c) => (c.currentClock === 1 ? c.clockLabelSingular : c.clockLabelPlural) || ''

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
      {statsModal && (
        <EditStatsModal
          matchUuid={uuid}
          player={statsModal}
          onClose={() => setStatsModal(null)}
          onSaved={() => loadInfo()}
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
          {/* Match configuration */}
          <div className="pg-card mb-4">
            <p className="pg-card-title mb-2"><i className="fas fa-sliders-h me-1" />Match configuration</p>

            {/* Match status + actions — compact first row */}
            <div
              className="flex items-center gap-3 flex-wrap mb-2"
              style={{
                borderLeft: `3px solid ${colors.border}`,
                background: colors.bg,
                borderRadius: 5,
                padding: '0.4rem 0.6rem',
              }}
            >
              <span style={{ fontSize: '0.72rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <i className="fas fa-circle-notch me-1" />Status
              </span>
              <span
                data-testid="match-status-label"
                style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em', color: colors.border }}
              >
                {status || '—'}
              </span>

              {actionError && (
                <span style={{ color: '#ef4444', fontSize: '0.78rem', flex: '1 1 100%' }}>
                  <i className="fas fa-exclamation-circle me-1" />{actionError}
                </span>
              )}

              <div className="flex gap-2 flex-wrap" style={{ flexShrink: 0, marginLeft: 'auto' }}>
                {/* Pause — only when RUNNING */}
                {status === 'RUNNING' && (
                  <button
                    className="pg-btn pg-btn-gold pg-btn-sm"
                    disabled={actionLoading}
                    onClick={handlePause}
                  >
                    <i className="fas fa-pause me-1" />Pause
                  </button>
                )}

                {/* Resume — only when PAUSED */}
                {status === 'PAUSED' && (
                  <button
                    className="pg-btn pg-btn-success pg-btn-sm"
                    disabled={actionLoading}
                    onClick={handleResume}
                  >
                    <i className="fas fa-play me-1" />Resume
                  </button>
                )}

                {/* Stop — when not yet terminal */}
                {!isTerminalStatus && (
                  <button
                    className="pg-btn pg-btn-danger pg-btn-sm"
                    disabled={actionLoading}
                    onClick={handleStop}
                  >
                    <i className="fas fa-stop me-1" />Stop match
                  </button>
                )}

                {/* Delete — only when terminal */}
                {isTerminalStatus && (
                  <button
                    className="pg-btn pg-btn-danger pg-btn-sm"
                    disabled={actionLoading}
                    onClick={handleDelete}
                  >
                    <i className="fas fa-trash me-1" />Delete match
                  </button>
                )}
              </div>
            </div>

            <table className="pg-table" style={{ fontSize: '0.82rem' }}>
              <tbody>
                <tr>
                  <th scope="row">Match UUID</th>
                  <td><UuidCopy uuid={match?.uuid}>{match?.uuid}</UuidCopy></td>
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
                  <th scope="row">Mode</th>
                  <td>{match?.singlePlayer === 0 ? 'Multiplayer' : 'Single'}</td>
                </tr>
                <tr>
                  <th scope="row">Clock</th>
                  <td>{match?.currentClock ?? 0}</td>
                  <th scope="row">XP Cost</th>
                  <td>{match?.expCost ?? 0}</td>
                </tr>
                <tr>
                  <th scope="row">Created</th>
                  <td>{fmtDate(match?.tsInsert)}</td>
                  <th scope="row">Current location</th>
                  <td>{info.currentLocationName || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Clock status (Step 26) — read-only clock cycle + sleeping characters */}
          {clock && (
            <div className="pg-card mb-4">
              <p className="pg-card-title mb-2"><i className="fas fa-hourglass-half me-1" />Clock status</p>
              <table className="pg-table" style={{ fontSize: '0.82rem' }}>
                <tbody>
                  <tr>
                    <th scope="row">Current clock</th>
                    <td>{clock.currentClock}{clockLabel(clock) ? ` (${clockLabel(clock)})` : ''}</td>
                  </tr>
                  <tr>
                    <th scope="row">Anyone sleeping</th>
                    <td>{clock.anyCharacterSleeping ? 'Yes' : 'No'}</td>
                  </tr>
                </tbody>
              </table>
              {clock.characters?.length > 0 && (
                <table className="pg-table" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  <thead>
                    <tr><th>Character</th><th>Energy</th><th>State</th></tr>
                  </thead>
                  <tbody>
                    {clock.characters.map(c => (
                      <tr key={c.characterUuid}>
                        <td>{clockCharName(c.characterUuid)}</td>
                        <td>{c.energy}</td>
                        <td>{c.isSleeping ? 'Sleeping' : 'Awake'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

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
                    <th>Energy</th><th>Life</th><th>Sad</th><th>Weight</th>
                    <th>Items</th>
                    <th>Position</th><th>State</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 && (
                    <tr><td colSpan={15} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>
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
                      <td>{p.energyMax != null ? `${p.energy}/${p.energyMax}` : p.energy}</td>
                      <td>{p.lifeMax != null ? `${p.life}/${p.lifeMax}` : p.life}</td>
                      <td>{p.sadMax != null ? `${p.sad}/${p.sadMax}` : p.sad}</td>
                      <td>{p.weightMax != null ? `${p.weight ?? 0}/${p.weightMax}` : (p.weight ?? '—')}</td>
                      <td>
                        {(p.items?.length > 0)
                          ? (
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                              {p.items.map(it => (
                                <li key={it.uuid} style={{ whiteSpace: 'nowrap' }}>
                                  {(it.name || shortUuid(it.itemUuid))} ×{it.amount ?? 1}
                                </li>
                              ))}
                            </ul>
                          )
                          : '—'}
                      </td>
                      <td>{p.locationName || (p.idLocation != null ? `#${p.idLocation}` : '—')}</td>
                      <td><StateBadges player={p} /></td>
                      <td>
                        <button
                          className="pg-btn pg-btn-ghost"
                          style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                          onClick={() => setStatsModal(p)}
                          title="Edit statistics"
                        >
                          <i className="fas fa-sliders-h" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Locations */}
          <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
            <p className="pg-card-title" style={{ padding: '0.75rem 1rem 0' }}>
              <i className="fas fa-map me-1" />Location state — gaming_state_locations ({info.locations?.length ?? 0})
            </p>
            {/* Step 26 — the Counter column is the residual location time counter
                (clock_counter), decremented at each time-start; it reaches 0 to fire
                the location's counter-zero event (executed in Step 29). */}
            <div style={{ overflowX: 'auto' }}>
              <table className="pg-table" style={{ fontSize: '0.78rem' }}>
                <thead><tr><th>UUID</th><th>Id</th><th>Activated</th><th>Counter</th></tr></thead>
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
          <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
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

          {/* Step 24 — projected turn order */}
          <div className="mb-4">
            <TurnOrderPanel players={players} nameOf={templateName} />
          </div>
        </>
      )}
    </div>
  )
}

import { useState } from 'react'
import { updateMatchRegistry, deleteMatchRegistry } from '../../../api/matchApi'

/**
 * RegistryCard — the match registry (gaming_state_registry): key + the SET of values it holds.
 * Step 36.1 — a multi-valued key owns several values, so the column shows the whole set.
 * v0.36.2 — and the console can correct one: every write lands in the log as a REGISTRY_CHANGE.
 * v0.36.3 — the admin payload carries the HIDDEN keys too (the player's never does), so the
 * table says of each which it is rather than silently leaving half the state out.
 */
export default function RegistryCard({ registry, matchUuid, onChanged }) {
  const rows = registry ?? []
  const [editing, setEditing] = useState(null)   // { key, value } — the row being written
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')

  const editable = Boolean(matchUuid)
  // A key the story does not mark PUBLIC — the board never shows it to a player, and neither
  // does one the story no longer declares at all. The console shows both, labelled.
  const isHidden = (row) => row.visible === false
  const hiddenCount = rows.filter(isHidden).length

  // Every write refreshes the whole card: the answer carries one key, the payload carries all.
  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setEditing(null)
      if (onChanged) await onChanged()
    } catch (e) {
      setError(e.message || 'The registry write failed.')
    } finally {
      setBusy(false)
    }
  }

  const save = () => run(() => updateMatchRegistry(matchUuid, {
    key: editing.key, value: editing.value,
  }))

  // No value named: the key is emptied whatever it holds, set or single.
  const clear = (key) => run(() => deleteMatchRegistry(matchUuid, key))

  // On a multi key this takes one member away; on a single one it is compare-and-clear.
  const removeValue = (key, value) => run(() => deleteMatchRegistry(matchUuid, key, value))

  return (
    <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
      <p className="pg-card-title" style={{ padding: '0.75rem 1rem 0' }}>
        <i className="fas fa-list me-1" />Registry ({rows.length})
        {hiddenCount > 0 && (
          <span style={{ color: 'var(--color-ash)', fontWeight: 'normal', fontSize: '0.78rem' }}>
            {' '}· {hiddenCount} hidden
          </span>
        )}
      </p>
      {error && (
        <p className="pg-error" style={{ padding: '0 1rem', fontSize: '0.8rem' }}>{error}</p>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="pg-table" style={{ fontSize: '0.78rem' }}>
          <thead>
            <tr><th>Key</th><th>Multi</th><th>Visibility</th><th>Values</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No registry entries.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.uuid ?? r.key}>
                <td>
                  {r.key}
                  {isHidden(r) && (
                    <i className="fas fa-eye-slash ms-1" style={{ color: 'var(--color-ash)' }}
                       title="hidden key — the player never sees this one" />
                  )}
                </td>
                <td>{r.multiValue ? 'yes' : 'no'}</td>
                <td style={{ color: isHidden(r) ? 'var(--color-ash)' : 'inherit' }}>
                  {isHidden(r) ? 'hidden' : 'public'}
                </td>
                {/* v0.36.3 — one column for the whole set: the members themselves, each with
                    the ✕ that takes it away, and the buttons that write a new one. The values
                    are a LIST however long, so the cell wraps rather than running off the
                    table, and the editor opens right where the values are read. */}
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem',
                                alignItems: 'center' }}>
                    {editing?.key === r.key ? (
                      <>
                        <input
                          className="pg-input"
                          style={{ fontSize: '0.78rem', flex: '1 1 8rem', minWidth: '6rem' }}
                          value={editing.value}
                          autoFocus
                          aria-label={`New value for ${r.key}`}
                          onChange={e => setEditing({ ...editing, value: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') save() }}
                        />
                        <button className="pg-btn pg-btn-sm" disabled={busy} onClick={save}
                                title={r.multiValue ? 'add this member' : 'replace the value'}>
                          <i className="fas fa-check" />
                        </button>
                        <button className="pg-btn pg-btn-sm" disabled={busy}
                                onClick={() => setEditing(null)} title="cancel">
                          <i className="fas fa-times" />
                        </button>
                      </>
                    ) : (
                      <>
                        {(r.values ?? []).length === 0 && (
                          <span style={{ color: 'var(--color-ash)' }}>—</span>
                        )}
                        {/* A member goes one at a time; the eraser below empties the key whole. */}
                        {(r.values ?? []).map(v => (
                          <span key={v}
                                style={{ display: 'inline-flex', alignItems: 'center',
                                         gap: '0.25rem', padding: '0.05rem 0.1rem 0.05rem 0.4rem',
                                         border: '1px solid var(--color-ash)', borderRadius: 4,
                                         maxWidth: '100%', wordBreak: 'break-all' }}>
                            {v}
                            {editable && (
                              <button className="pg-btn pg-btn-sm" disabled={busy}
                                      onClick={() => removeValue(r.key, v)}
                                      title={`remove ${v}`}
                                      aria-label={`Remove ${v} from ${r.key}`}>
                                <i className="fas fa-xmark" />
                              </button>
                            )}
                          </span>
                        ))}
                        {editable && (
                          <>
                            <button className="pg-btn pg-btn-sm" disabled={busy}
                                    onClick={() => setEditing({ key: r.key, value: '' })}
                                    title="write a value" aria-label={`Edit ${r.key}`}>
                              <i className="fas fa-pen" />
                            </button>
                            <button className="pg-btn pg-btn-sm pg-btn-danger" disabled={busy}
                                    onClick={() => clear(r.key)}
                                    title="empty this key" aria-label={`Clear ${r.key}`}>
                              <i className="fas fa-eraser" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div style={{ padding: '0 1rem 0.75rem' }}>
          {editing?.key === '' || editing?.isNew ? (
            <div className="d-flex gap-1">
              <input className="pg-input" style={{ fontSize: '0.78rem' }} placeholder="key"
                     aria-label="New registry key" value={editing.newKey ?? ''}
                     onChange={e => setEditing({ ...editing, newKey: e.target.value })} />
              <input className="pg-input" style={{ fontSize: '0.78rem' }} placeholder="value"
                     aria-label="New registry value" value={editing.value}
                     onChange={e => setEditing({ ...editing, value: e.target.value })} />
              <button className="pg-btn pg-btn-sm" disabled={busy || !editing.newKey}
                      onClick={() => run(() => updateMatchRegistry(matchUuid, {
                        key: editing.newKey, value: editing.value,
                      }))}>
                <i className="fas fa-check me-1" />Write
              </button>
              <button className="pg-btn pg-btn-sm" disabled={busy}
                      onClick={() => setEditing(null)}>Cancel</button>
            </div>
          ) : (
            <button className="pg-btn pg-btn-sm" disabled={busy}
                    onClick={() => setEditing({ isNew: true, key: '', newKey: '', value: '' })}>
              <i className="fas fa-plus me-1" />Add a key
            </button>
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { updateMatchRegistry, deleteMatchRegistry } from '../../../api/matchApi'

/**
 * RegistryCard — the match registry (gaming_state_registry): key + the SET of values it holds.
 * Step 36.1 — a multi-valued key owns several values, so the column shows the whole set.
 * v0.36.2 — and the console can correct one: every write lands in the log as a REGISTRY_CHANGE.
 */
export default function RegistryCard({ registry, matchUuid, onChanged }) {
  const rows = registry ?? []
  const [editing, setEditing] = useState(null)   // { key, value } — the row being written
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')

  const editable = Boolean(matchUuid)

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
      </p>
      {error && (
        <p className="pg-error" style={{ padding: '0 1rem', fontSize: '0.8rem' }}>{error}</p>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="pg-table" style={{ fontSize: '0.78rem' }}>
          <thead>
            <tr><th>Key</th><th>Values</th><th>Multi</th>{editable && <th>Actions</th>}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={editable ? 4 : 3} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No registry entries.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.uuid ?? r.key}>
                <td>{r.key}</td>
                <td style={{ wordBreak: 'break-all' }}>
                  {editing?.key === r.key ? (
                    <input
                      className="pg-input"
                      style={{ fontSize: '0.78rem', width: '100%' }}
                      value={editing.value}
                      autoFocus
                      aria-label={`New value for ${r.key}`}
                      onChange={e => setEditing({ ...editing, value: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') save() }}
                    />
                  ) : (
                    (r.values ?? []).length === 0 ? '—' : (r.values ?? []).join(', ')
                  )}
                </td>
                <td>{r.multiValue ? 'yes' : 'no'}</td>
                {editable && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {editing?.key === r.key ? (
                      <>
                        <button className="pg-btn pg-btn-sm" disabled={busy} onClick={save}
                                title={r.multiValue ? 'add this member' : 'replace the value'}>
                          <i className="fas fa-check" />
                        </button>
                        <button className="pg-btn pg-btn-sm ms-1" disabled={busy}
                                onClick={() => setEditing(null)} title="cancel">
                          <i className="fas fa-times" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="pg-btn pg-btn-sm" disabled={busy}
                                onClick={() => setEditing({ key: r.key, value: '' })}
                                title="write a value" aria-label={`Edit ${r.key}`}>
                          <i className="fas fa-pen" />
                        </button>
                        {/* A multi key drops one member at a time; the eraser empties it whole. */}
                        {r.multiValue && (r.values ?? []).map(v => (
                          <button key={v} className="pg-btn pg-btn-sm ms-1" disabled={busy}
                                  onClick={() => removeValue(r.key, v)}
                                  title={`remove ${v}`}>
                            <i className="fas fa-minus" /> {v}
                          </button>
                        ))}
                        <button className="pg-btn pg-btn-sm pg-btn-danger ms-1" disabled={busy}
                                onClick={() => clear(r.key)}
                                title="empty this key" aria-label={`Clear ${r.key}`}>
                          <i className="fas fa-eraser" />
                        </button>
                      </>
                    )}
                  </td>
                )}
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

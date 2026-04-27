import { useState } from 'react'

/**
 * Generic table for story sub-entities.
 * 
 * @param {Object} props
 * @param {Array} props.entities - List of entities to display
 * @param {Array} props.columns - Column definitions: { key, label, type, render }
 * @param {Array} props.texts - List of story texts to resolve idText references
 * @param {Function} props.onEdit - Callback when edit is clicked
 * @param {Function} props.onDelete - Callback when delete is clicked
 */
export default function EntityTable({ entities, columns, texts = [], onEdit, onDelete }) {
  const [search, setSearch] = useState('')

  // Show max 3 columns from the definition
  const visibleColumns = columns.slice(0, 3)

  // Helper to resolve short_text for a given idText
  const resolveText = (idText) => {
    if (!idText || !texts) return ''
    const match = texts.find(t => t.idText === idText && t.lang === 'en') || texts.find(t => t.idText === idText)
    return match ? match.shortText : `[Text #${idText}]`
  }

  const filtered = entities.filter(e =>
    !search ||
    Object.values(e).some(val => String(val).toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="pg-card" style={{ padding: 0 }}>
      <div className="p-3 border-b border-white/5 flex items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-white/30" style={{ fontSize: '0.8rem' }} />
          <input
            className="pg-input pl-8 py-1 text-sm"
            placeholder="Search in table..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="pg-table pg-table-sm">
          <thead>
            <tr>
              <th style={{ width: 100 }}>ID</th>
              {visibleColumns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap', width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={visibleColumns.length + 2} className="text-center py-8 text-white/20">No items found.</td></tr>
            )}
            {filtered.map(ent => (
              <tr key={ent.uuid || ent.id}>
                <td>
                  <span
                    className="font-mono text-white/60"
                    style={{ fontSize: '0.78rem', cursor: 'default' }}
                    title={ent.uuid || ''}
                  >
                    {ent.id ?? '—'}
                  </span>
                </td>
                {visibleColumns.map(col => {
                  let content = ent[col.key]

                  if (col.type === 'idTextName') {
                    const textVal = resolveText(ent[col.key])
                    return (
                      <td key={col.key}>
                        <span className="text-white/40 me-1">#{ent[col.key]}</span>
                        <span className="font-semibold">{textVal}</span>
                      </td>
                    )
                  }

                  if (col.type === 'idTextDescription') {
                    const textVal = resolveText(ent[col.key])
                    return (
                      <td key={col.key}>
                        <span className="text-white/40" title={textVal}>
                          #{ent[col.key]} <i className="fas fa-info-circle ms-1" />
                        </span>
                      </td>
                    )
                  }

                  if (col.render) {
                    content = col.render(ent)
                  }

                  return <td key={col.key}>{content ?? '—'}</td>
                })}
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="pg-btn pg-btn-ghost pg-btn-sm me-1" onClick={() => onEdit(ent)}>
                    <i className="fas fa-edit" />
                  </button>
                  <button className="pg-btn pg-btn-ghost pg-btn-sm text-red-400 hover:text-red-300" onClick={() => onDelete(ent)}>
                    <i className="fas fa-trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

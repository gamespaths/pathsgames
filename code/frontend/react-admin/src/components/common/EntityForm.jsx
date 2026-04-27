import { useState, useEffect } from 'react'

/**
 * Generic form for story sub-entities.
 * 
 * @param {Object} props
 * @param {Object} props.entity - Entity data to edit (null for create)
 * @param {Array} props.fields - Field definitions: { key, label, type }
 * @param {Function} props.onSave - Callback when save is clicked
 * @param {Function} props.onCancel - Callback when cancel is clicked
 */
export default function EntityForm({ entity, fields, onSave, onCancel }) {
  const [data, setData] = useState({})

  useEffect(() => {
    setData(entity || {})
  }, [entity])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(data)
  }

  return (
    <div className="pg-modal-backdrop" onClick={onCancel}>
      <div
        className="pg-modal"
        style={{ maxWidth: 720, width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="pg-modal-title" style={{ flexShrink: 0 }}>
          <i className={`fas ${entity ? 'fa-edit' : 'fa-plus'} me-2`} />
          {entity ? 'Edit Entity' : 'Create Entity'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              paddingRight: 4,
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px 16px',
              alignItems: 'start',
            }}
          >
            {fields.map(field => (
              <div key={field.key} style={field.type === 'checkbox' ? { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 } : {}}>
                {field.type !== 'checkbox' && (
                  <label className="pg-label" style={{ fontSize: '0.75rem', marginBottom: 3 }}>{field.label}</label>
                )}
                {field.type === 'select' ? (
                  <select
                    className="pg-input"
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                    value={data[field.key] || ''}
                    onChange={e => setData({...data, [field.key]: e.target.value})}
                  >
                    <option value="">Select...</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <>
                    <input
                      type="checkbox"
                      checked={!!data[field.key]}
                      onChange={e => setData({...data, [field.key]: e.target.checked})}
                    />
                    <span style={{ fontSize: '0.8rem' }}>{field.label}</span>
                  </>
                ) : (
                  <input
                    type={field.type || 'text'}
                    className="pg-input"
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                    value={data[field.key] ?? ''}
                    onChange={e => setData({...data, [field.key]: field.type === 'number' ? (e.target.value === '' ? '' : parseInt(e.target.value)) : e.target.value})}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-4" style={{ flexShrink: 0, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button type="button" className="pg-btn pg-btn-ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="pg-btn pg-btn-gold px-6">Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}

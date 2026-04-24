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
      <div className="pg-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <h3 className="pg-modal-title">
          <i className={`fas ${entity ? 'fa-edit' : 'fa-plus'} me-2`} />
          {entity ? 'Edit Entity' : 'Create Entity'}
        </h3>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-4">
          {fields.map(field => (
            <div key={field.key}>
              <label className="pg-label">{field.label}</label>
              {field.type === 'select' ? (
                <select 
                  className="pg-input" 
                  value={data[field.key] || ''} 
                  onChange={e => setData({...data, [field.key]: e.target.value})}
                >
                  <option value="">Select...</option>
                  {field.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={!!data[field.key]} 
                    onChange={e => setData({...data, [field.key]: e.target.checked})} 
                  />
                  <span className="text-sm text-ash">{field.label}</span>
                </div>
              ) : (
                <input 
                  type={field.type || 'text'} 
                  className="pg-input" 
                  value={data[field.key] || ''} 
                  onChange={e => setData({...data, [field.key]: field.type === 'number' ? parseInt(e.target.value) : e.target.value})} 
                />
              )}
            </div>
          ))}
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="pg-btn pg-btn-ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="pg-btn pg-btn-gold px-6">Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}

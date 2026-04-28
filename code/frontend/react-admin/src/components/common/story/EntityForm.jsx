import { useState, useEffect } from 'react'
import PathsSelector from './PathsSelector'
import FastTextSelectorModal from './FastTextSelectorModal'
import PathsOptionsSelectorModal from './PathsOptionsSelectorModal'

/**
 * Generic form for story sub-entities.
 * 
 * @param {Object} props
 * @param {Object} props.entity - Entity data to edit (null for create)
 * @param {Array} props.fields - Field definitions: { key, label, type }
 * @param {Function} props.onSave - Callback when save is clicked
 * @param {Function} props.onCancel - Callback when cancel is clicked
 */
export default function EntityForm({
  entity,
  initialData,
  fields,
  onSave,
  onCancel,
  storyUuid,
  storyOptions,
  texts,
  onSaveFastText,
  pathSelectorOptions,
  onCreateFastCard,
}) {
  const [data, setData] = useState({})
  const [selectorState, setSelectorState] = useState(null)
  const [descManuallySelected, setDescManuallySelected] = useState(false)
  const [isCreatingFastCard, setIsCreatingFastCard] = useState(false)
  const isEditMode = !!entity?.uuid

  useEffect(() => {
    setData(entity || initialData || {})
    setSelectorState(null)
    setDescManuallySelected(false)
  }, [entity, initialData])

  const TEXT_SELECTOR_KEYS = new Set([
    'idTextName',
    'idTextDescription',
    'idTextNarrative',
    'idTextGo',
    'idTextBack',
    'idText',
    'idTextTitle',
    'idTextCopyright',
    'idImage',
  ])

  const isPathsTextSelector = (field) => {
    if (!onSaveFastText || !storyUuid) return false
    return TEXT_SELECTOR_KEYS.has(field.key)
  }

  const isPathsOptionSelector = (field) => {
    return !!pathSelectorOptions?.[field.key]
  }

  const hasNameAndDesc = fields.some(field => field.key === 'idTextName')
    && fields.some(field => field.key === 'idTextDescription')

  const getEnShortText = (idText) => {
    if (idText === null || idText === undefined || idText === '') return ''
    const target = texts?.find(item => Number(item.idText) === Number(idText) && item.lang === 'en')
    if (!target) return `Text #${idText} (EN not found)`
    return `#${idText} ${target.shortText || '(empty)'}`
  }

  const setFieldValue = (field, value) => {
    if (field.type === 'number' || field.valueType === 'number') {
      setData({
        ...data,
        [field.key]: value === '' ? '' : Number(value),
      })
      return
    }

    setData({ ...data, [field.key]: value })
  }

  const applyTextSelection = (fieldKey, idText) => {
    const selectedId = Number(idText)
    setData(prev => {
      const next = { ...prev, [fieldKey]: selectedId }
      if (fieldKey === 'idTextName' && hasNameAndDesc && !descManuallySelected) {
        next.idTextDescription = selectedId
      }
      return next
    })

    if (fieldKey === 'idTextDescription') {
      setDescManuallySelected(true)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(data)
  }

  const getPathOptionDisplay = (fieldKey, value) => {
    const options = pathSelectorOptions?.[fieldKey]?.options || []
    const match = options.find(option => String(option.value) === String(value))
    return match?.label || (value !== null && value !== undefined && value !== '' ? `#${value}` : '')
  }

  const normalizeOptionValue = (fieldKey, value) => {
    const config = pathSelectorOptions?.[fieldKey] || {}
    const valueType = config.valueType || 'number'

    if (valueType === 'string') {
      return value === null || value === undefined ? '' : String(value)
    }

    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : ''
  }

  return (
    <div className="pg-modal-backdrop" onClick={onCancel} data-testid="entity-form-backdrop">
      <div
        className="pg-modal"
        style={{ maxWidth: 720, width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="pg-modal-title" style={{ flexShrink: 0 }}>
          <i className={`fas ${isEditMode ? 'fa-edit' : 'fa-plus'} me-2`} />
          {isEditMode ? 'Edit Entity' : 'Create Entity'}
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
                {field.type !== 'checkbox' && !isPathsTextSelector(field) && !isPathsOptionSelector(field) && (
                  <label htmlFor={`field-${field.key}`} className="pg-label" style={{ fontSize: '0.75rem', marginBottom: 3 }}>{field.label}</label>
                )}
                {isPathsTextSelector(field) ? (
                  <PathsSelector
                    label={field.label}
                    name={field.key}
                    value={data[field.key] ?? ''}
                    displayValue={getEnShortText(data[field.key])}
                    placeholder="No text selected"
                    onOpenSelector={() => setSelectorState({ field, startMode: 'list' })}
                    onOpenCreator={() => setSelectorState({ field, startMode: 'input-generator' })}
                    onClear={() => setData(prev => ({ ...prev, [field.key]: '' }))}
                    showNewButton
                  />
                ) : isPathsOptionSelector(field) ? (
                  <PathsSelector
                    label={field.label}
                    name={field.key}
                    value={data[field.key] ?? ''}
                    displayValue={getPathOptionDisplay(field.key, data[field.key])}
                    placeholder="No value selected"
                    onOpenSelector={() => setSelectorState({ field, startMode: 'options' })}
                    onOpenCreator={async () => {
                      if (field.key !== 'idCard' || !onCreateFastCard || isCreatingFastCard) return
                      try {
                        setIsCreatingFastCard(true)
                        const createdIdCard = await onCreateFastCard({
                          storyUuid,
                          formData: data,
                        })
                        if (Number.isFinite(Number(createdIdCard))) {
                          setData(prev => ({ ...prev, idCard: Number(createdIdCard) }))
                        }
                      } finally {
                        setIsCreatingFastCard(false)
                      }
                    }}
                    onClear={() => {
                      const config = pathSelectorOptions?.[field.key] || {}
                      const valueType = config.valueType || 'number'
                      setData(prev => ({
                        ...prev,
                        [field.key]: valueType === 'string' ? '' : '',
                      }))
                    }}
                    showNewButton={field.key === 'idCard' && !!onCreateFastCard}
                    newButtonLabel={isCreatingFastCard ? 'Creating...' : 'New Fast Card'}
                    newButtonIcon="fa-clone"
                  />
                ) : field.type === 'select' ? (
                  <select
                    id={`field-${field.key}`}
                    className="pg-input"
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                    value={data[field.key] || ''}
                    onChange={e => setFieldValue(field, e.target.value)}
                  >
                    <option value="">Select...</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <>
                    <input
                      id={`field-${field.key}`}
                      type="checkbox"
                      checked={!!data[field.key]}
                      onChange={e => setData({...data, [field.key]: e.target.checked})}
                    />
                    <span style={{ fontSize: '0.8rem' }}>{field.label}</span>
                  </>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={`field-${field.key}`}
                    className="pg-textarea"
                    rows={3}
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                    value={data[field.key] ?? ''}
                    onChange={e => setFieldValue(field, e.target.value)}
                  />
                ) : (
                  <input
                    id={`field-${field.key}`}
                    type={field.type || 'text'}
                    className="pg-input"
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                    value={data[field.key] ?? ''}
                    onChange={e => setFieldValue(field, e.target.value)}
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

      <FastTextSelectorModal
        open={!!selectorState && selectorState.startMode !== 'options'}
        onClose={() => setSelectorState(null)}
        texts={texts || []}
        selectedId={selectorState ? data[selectorState.field.key] : ''}
        storyOptions={storyOptions || []}
        storyUuid={storyUuid}
        onSaveFastText={onSaveFastText}
        startMode={selectorState?.startMode || 'list'}
        onSelect={(idText) => {
          if (!selectorState) return
          applyTextSelection(selectorState.field.key, idText)
          setSelectorState(null)
        }}
      />

      <PathsOptionsSelectorModal
        open={!!selectorState && selectorState.startMode === 'options'}
        onClose={() => setSelectorState(null)}
        selectedValue={selectorState ? data[selectorState.field.key] : ''}
        title={selectorState ? `Select ${selectorState.field.label}` : 'Select value'}
        searchPlaceholder="Search by id or label"
        options={selectorState ? (pathSelectorOptions?.[selectorState.field.key]?.options || []) : []}
        onSelect={(value) => {
          if (!selectorState) return
          const normalized = normalizeOptionValue(selectorState.field.key, value)
          setData(prev => ({ ...prev, [selectorState.field.key]: normalized }))
          setSelectorState(null)
        }}
      />
    </div>
  )
}

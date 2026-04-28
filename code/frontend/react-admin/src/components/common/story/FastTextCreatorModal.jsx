import { useEffect, useMemo, useState } from 'react'

export default function FastTextCreatorModal({
  open,
  onClose,
  onSave,
  storyOptions,
  initialStoryUuid,
  initialTextId,
  initialValues,
  mode = 'create',
}) {
  const [storyUuid, setStoryUuid] = useState(initialStoryUuid || '')
  const [idText, setIdText] = useState(initialTextId ?? '')
  const [enShortText, setEnShortText] = useState('')
  const [enLongText, setEnLongText] = useState('')
  const [itShortText, setItShortText] = useState('')
  const [itLongText, setItLongText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = useMemo(() => {
    return !!storyUuid && idText !== ''
  }, [storyUuid, idText])

  useEffect(() => {
    if (!open) return
    setStoryUuid(initialStoryUuid || storyOptions?.[0]?.value || '')
    setIdText(initialTextId ?? '')
    setEnShortText(initialValues?.en?.shortText || '')
    setEnLongText(initialValues?.en?.longText || '')
    setItShortText(initialValues?.it?.shortText || '')
    setItLongText(initialValues?.it?.longText || '')
    setSaving(false)
    setError('')
  }, [open, initialStoryUuid, initialTextId, initialValues, storyOptions])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) {
      setError('Story and Text ID are required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const result = await onSave({
        uuidStory: storyUuid,
        idText: Number(idText),
        translations: {
          en: { shortText: enShortText, longText: enLongText },
          it: { shortText: itShortText, longText: itLongText },
        },
      })
      onClose(result)
    } catch (e2) {
      setError(e2?.message || 'Cannot save fast text')
      setSaving(false)
    }
  }

  return (
    <div className="pg-modal-backdrop" onClick={() => onClose(null)}>
      <div
        className="pg-modal"
        style={{ maxWidth: 860, width: '95vw' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="pg-modal-title">
          <i className={`fas ${mode === 'edit' ? 'fa-edit' : 'fa-plus'} me-2`} />
          Fast Text Creator
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fast-text-story" className="pg-label">Story</label>
              <select id="fast-text-story" className="pg-input" value={storyUuid} onChange={e => setStoryUuid(e.target.value)}>
                {storyOptions?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fast-text-id" className="pg-label">Text ID</label>
              <input
                id="fast-text-id"
                type="number"
                className="pg-input"
                value={idText}
                onChange={e => setIdText(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <div className="pg-fast-text-table">
            <div className="pg-fast-text-head">Language</div>
            <div className="pg-fast-text-head">Short Text</div>
            <div className="pg-fast-text-head">Long Text</div>

            <div className="pg-fast-text-lang">en</div>
            <input aria-label="en-short" className="pg-input" value={enShortText} onChange={e => setEnShortText(e.target.value)} />
            <textarea aria-label="en-long" className="pg-textarea" rows={3} value={enLongText} onChange={e => setEnLongText(e.target.value)} />

            <div className="pg-fast-text-lang">it</div>
            <input aria-label="it-short" className="pg-input" value={itShortText} onChange={e => setItShortText(e.target.value)} />
            <textarea aria-label="it-long" className="pg-textarea" rows={3} value={itLongText} onChange={e => setItLongText(e.target.value)} />
          </div>

          {error && (
            <div className="pg-alert pg-alert-danger">
              <i className="fas fa-exclamation-triangle" /> {error}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="pg-btn pg-btn-ghost" onClick={() => onClose(null)} disabled={saving}>Cancel</button>
            <button type="submit" className="pg-btn pg-btn-gold" disabled={saving || !canSubmit}>
              {saving ? 'Saving...' : 'Save Text'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

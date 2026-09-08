import { useState } from 'react'

/**
 * ChipListInput - Step 37. Edits a PIPE-separated list as chips.
 * The pipe is the storage format, never something an author types: a value containing one
 * would silently become two, so the separator stays the component's business.
 */
export default function ChipListInput({ id, value, onChange, placeholder = 'Add a value…' }) {
  const [draft, setDraft] = useState('')

  const values = String(value ?? '').split('|').map(v => v.trim()).filter(Boolean)

  const commit = (next) => onChange(next.length ? next.join('|') : '')

  const add = () => {
    const trimmed = draft.trim()
    // Blind to case, exactly as the backend compares: a set never holds two spellings.
    if (!trimmed || values.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('')
      return
    }
    commit([...values, trimmed])
    setDraft('')
  }

  const remove = (target) => commit(values.filter(v => v !== target))

  return (
    <div data-testid={`chips-${id}`}>
      <div className="d-flex flex-wrap gap-1 mb-1">
        {values.map(v => (
          <span key={v} className="pg-chip" data-testid={`chip-${v}`}>
            {v}
            <button
              type="button"
              className="pg-chip-remove"
              aria-label={`Remove ${v}`}
              onClick={() => remove(v)}
            >
              <i className="fas fa-xmark" />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>No value — the condition is never satisfied.</span>
        )}
      </div>
      <div className="d-flex gap-1">
        <input
          id={id}
          className="pg-input"
          style={{ fontSize: '0.8rem', padding: '4px 8px', flex: 1, minWidth: 0 }}
          value={draft}
          placeholder={placeholder}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="pg-btn pg-btn-sm" onClick={add} aria-label="Add value">
          <i className="fas fa-plus" />
        </button>
      </div>
    </div>
  )
}

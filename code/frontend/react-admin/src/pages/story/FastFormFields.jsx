/**
 * FastFormFields — inputs, text block, section and save report shared by the Fast New Event
 * and Fast New Locations pages.
 */
import { TEXT_MAX_LENGTH } from '../../constants/story/textLimits'

const INPUT_STYLE = { fontSize: '0.8rem', padding: '4px 8px', width: '100%', minWidth: 0, boxSizing: 'border-box' }
const LABEL_STYLE = { fontSize: '0.75rem', marginBottom: 3 }
// Literal class names: Tailwind only generates what it finds spelled out in the source.
export const GRID2 = 'grid grid-cols-1 md:grid-cols-2 gap-2'
export const GRID3 = 'grid grid-cols-1 md:grid-cols-3 gap-2'
export const GRID4 = 'grid grid-cols-1 md:grid-cols-4 gap-2'

export function TextField({ id, label, value, onChange, type = 'text', maxLength }) {
  return (
    <div>
      <label htmlFor={id} className="pg-label" style={LABEL_STYLE}>{label}</label>
      <input
        id={id}
        type={type}
        className="pg-input"
        style={INPUT_STYLE}
        value={value}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

// `placeholder` null hides the empty option (for selects that always hold a value).
export function SelectField({ id, label, value, options, onChange, placeholder = 'Select...' }) {
  return (
    <div>
      <label htmlFor={id} className="pg-label" style={LABEL_STYLE}>{label}</label>
      <select id={id} className="pg-input" style={INPUT_STYLE} value={value} onChange={e => onChange(e.target.value)}>
        {placeholder !== null && <option value="">{placeholder}</option>}
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  )
}

function TextAreaField({ id, label, value, onChange, className }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label htmlFor={id} className="pg-label" style={LABEL_STYLE}>{label}</label>
      <textarea
        id={id}
        className="pg-textarea flex-1"
        rows={3}
        style={INPUT_STYLE}
        value={value}
        maxLength={TEXT_MAX_LENGTH}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

// Title, description, copyright, link and image of one element (event, effect, choice…).
// Titles stacked in the first column, each description a textarea spanning both rows.
export function TextBlockFields({ idPrefix, block, onChange }) {
  const text = (key, label, className) => (
    <div className={className}>
      <TextField id={`${idPrefix}-${key}`} label={label} value={block[key]} maxLength={TEXT_MAX_LENGTH}
        onChange={v => onChange([key], v)} />
    </div>
  )
  const area = (key, label, className) => (
    <TextAreaField id={`${idPrefix}-${key}`} label={label} value={block[key]} className={className}
      onChange={v => onChange([key], v)} />
  )
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {text('titleEn', 'Title (EN)', 'md:col-start-1 md:row-start-1')}
        {text('titleIt', 'Title (IT)', 'md:col-start-1 md:row-start-2')}
        {area('descEn', 'Description (EN)', 'md:col-start-2 md:row-start-1 md:row-span-2')}
        {area('descIt', 'Description (IT)', 'md:col-start-3 md:row-start-1 md:row-span-2')}
      </div>
      <div className={`${GRID3} mt-2`}>
        {text('copyright', 'Copyright Text')}
        <TextField id={`${idPrefix}-link`} label="Copyright Link" value={block.link} onChange={v => onChange(['link'], v)} />
        <TextField id={`${idPrefix}-urlImage`} label="Image URL" value={block.urlImage} onChange={v => onChange(['urlImage'], v)} />
      </div>
    </>
  )
}

export function Section({ title, icon, headerExtra, children }) {
  return (
    <div className="pg-card mb-3" style={{ padding: '0.75rem' }}>
      <div className="flex items-center gap-4" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        <h3 className="pg-label" style={{ fontSize: '0.9rem', margin: 0 }}>
          <i className={`fas ${icon} me-2`} />{title}
        </h3>
        {headerExtra}
      </div>
      {children}
    </div>
  )
}

function CloseButton({ onClose }) {
  return (
    <button type="button" onClick={onClose} className="ml-auto opacity-60 hover:opacity-100" title="Close report" aria-label="Close report">
      <i className="fas fa-times" />
    </button>
  )
}

/** Report box of a save: entities written, or the error with the rollback outcome and orphans. */
export function SaveSummary({ result, onClose, testId, successText }) {
  if (!result) return null
  if (result.ok) {
    return (
      <div className="pg-alert pg-alert-success mb-3" data-testid={testId}>
        <i className="fas fa-check-circle mt-0.5" />
        <div>
          {successText} — {result.created.length} entities written:
          <ul className="mt-1" style={{ fontSize: '0.8rem' }}>
            {result.created.map((c, i) => <li key={`${c.uuid}-${i}`}>{c.entityType}: {c.label}</li>)}
          </ul>
        </div>
        <CloseButton onClose={onClose} />
      </div>
    )
  }
  return (
    <div className="pg-alert pg-alert-danger mb-3" data-testid={testId}>
      <i className="fas fa-exclamation-triangle mt-0.5" />
      <div>
        Save failed: {result.error}.
        {' '}Rolled back {result.created.length - result.orphans.length} of {result.created.length} entities.
        {result.orphans.length > 0 && (
          <>
            <div className="mt-1">Left orphaned (delete them by hand):</div>
            <ul style={{ fontSize: '0.8rem' }}>
              {result.orphans.map((o, i) => <li key={`${o.uuid}-${i}`}>{o.entityType}: {o.label}{o.uuid ? ` (${o.uuid})` : ''}</li>)}
            </ul>
          </>
        )}
      </div>
      <CloseButton onClose={onClose} />
    </div>
  )
}

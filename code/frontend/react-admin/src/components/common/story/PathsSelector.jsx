export default function PathsSelector({
  label,
  name,
  value,
  displayValue,
  placeholder = 'Not selected',
  onOpenSelector,
  onOpenCreator,
  showNewButton = true,
  newButtonLabel = '',//New
  newButtonIcon = 'fa-plus',
  showClearButton = true,
  clearButtonLabel = '',//Null
  clearButtonIcon = 'fa-eraser',
  selectButtonLabel = '',//Select
  onClear,
}) {
  return (
    <div className="pg-paths-selector-wrap">
      <label htmlFor={name} className="pg-label" style={{ fontSize: '0.75rem', marginBottom: 3 }}>{label}</label>
      <input type="hidden" id={name} name={name} value={value ?? ''} />
      <div className="pg-paths-selector">
        <span className="pg-paths-selector-value" title={displayValue || placeholder}>
          {displayValue || placeholder}
        </span>
        <div className="pg-paths-selector-actions">
          <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={onOpenSelector} title={`Select ${label}`}>
            <i className="fas fa-pen" />
            {selectButtonLabel}
          </button>
          {showClearButton && (
            <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={onClear} title={`Clear ${label}`}>
              <i className={`fas ${clearButtonIcon}`} />
              {clearButtonLabel}
            </button>
          )}
          {showNewButton && (
            <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={onOpenCreator} title={`New ${label}`}>
              <i className={`fas ${newButtonIcon}`} />
              {newButtonLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

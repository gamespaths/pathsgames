import { useMemo, useState } from 'react'

export default function PathsOptionsSelectorModal({
  open,
  onClose,
  onSelect,
  selectedValue,
  title = 'Select value',
  searchPlaceholder = 'Search...',
  options = [],
}) {
  const [search, setSearch] = useState('')

  const filteredOptions = useMemo(() => {
    const validOptions = options.filter(option => {
      const raw = option?.value
      if (raw === null || raw === undefined) return false
      if (typeof raw === 'number') return Number.isFinite(raw)
      if (typeof raw === 'string') return raw.trim() !== ''
      const numeric = Number(raw)
      return Number.isFinite(numeric) || String(raw).trim() !== ''
    })

    const query = search.trim().toLowerCase()
    if (!query) return [...validOptions].reverse()

    return validOptions.filter(option => (
      String(option.value).toLowerCase().includes(query)
      || String(option.label || '').toLowerCase().includes(query)
    )).reverse()
  }, [options, search])

  if (!open) return null

  return (
    <div className="pg-modal-backdrop" onClick={onClose}>
      <div className="pg-modal" style={{ maxWidth: 800, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <h3 className="pg-modal-title">
          <i className="fas fa-search me-2" /> {title}
        </h3>

        <div className="mt-4 mb-3">
          <input
            className="pg-input"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="pg-fast-selector-list">
          <table className="pg-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Value</th>
                <th>Label</th>
                <th style={{ width: 130 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOptions.map(option => (
                <tr key={`${option.value}`}>
                  <td>
                    {Number.isFinite(Number(option.value)) ? `#${option.value}` : String(option.value)}
                  </td>
                  <td>{option.label}</td>
                  <td>
                    <button
                      type="button"
                      className="pg-btn pg-btn-ghost pg-btn-sm"
                      onClick={() => {
                        onSelect(option.value)
                        onClose()
                      }}
                    >
                      {String(selectedValue) === String(option.value) ? 'Selected' : 'Select'}
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredOptions.length && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>
                    No values found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <button type="button" className="pg-btn pg-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

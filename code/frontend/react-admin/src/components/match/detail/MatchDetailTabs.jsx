/**
 * MatchDetailTabs — horizontal tab navigation of the match detail page.
 * Presentational: receives the tab list + active id, notifies the parent on click.
 *
 * @param {Object[]} tabs       - [{ id, label, icon }]
 * @param {string}   activeTab  - id of the selected tab
 * @param {Function} onSelect   - called with the tab id on click
 */
export default function MatchDetailTabs({ tabs, activeTab, onSelect }) {
  return (
    <div className="flex gap-2 flex-wrap mb-4" role="tablist">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          className={`pg-btn pg-btn-sm ${activeTab === t.id ? 'pg-btn-primary' : 'pg-btn-ghost'}`}
          onClick={() => onSelect(t.id)}
        >
          <i className={`fas ${t.icon} me-1`} />{t.label}
        </button>
      ))}
    </div>
  )
}

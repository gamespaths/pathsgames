/**
 * StoryEditorPageSidebar — the vertical tab navigation of the story editor.
 * Presentational component: receives the tab list and the active tab,
 * notifies the parent via `onSelectTab`.
 *
 * @param {Object[]} tabs        - [{ id, label, icon }]
 * @param {string}   activeTab   - id of the currently selected tab
 * @param {Function} onSelectTab - called with the tab id on click
 * @param {Function} [onOpenCardsFastEdit] - when given, a last entry opens the Cards Fast Edit page
 * @param {Function} [onOpenFastNewEvent]  - when given, a last entry opens the Fast New Event page
 */
export default function StoryEditorPageSidebar({ tabs, activeTab, onSelectTab, onOpenCardsFastEdit, onOpenFastNewEvent }) {
  return (
    <div className="w-full md:w-[9.6rem] flex-shrink-0">
      <div className="pg-card sticky top-4" style={{ padding: '0.5rem' }}>
        <nav className="flex flex-col gap-05">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-1 px-1 py-1 rounded transition-all text-sm ${
                activeTab === tab.id ? 'bg-gold-dark/20 text-gold-light' : 'text-ash hover:bg-white/5'
              }`}
            >
              <i className={`fas ${tab.icon} w-5 text-center`} />
              {tab.label}
            </button>
          ))}
          {onOpenCardsFastEdit && (
            <button
              onClick={onOpenCardsFastEdit}
              className="flex items-center gap-1 px-1 py-1 rounded transition-all text-sm text-ash hover:bg-white/5"
            >
              <i className="fas fa-id-card w-5 text-center" />
              Cards fast edit
            </button>
          )}
          {onOpenFastNewEvent && (
            <button
              onClick={onOpenFastNewEvent}
              className="flex items-center gap-1 px-1 py-1 rounded transition-all text-sm text-ash hover:bg-white/5"
            >
              <i className="fas fa-bolt w-5 text-center" />
              Fast new event
            </button>
          )}
        </nav>
      </div>
    </div>
  )
}

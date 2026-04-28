export default function FooterBar({ isSidebarVisible, onToggleSidebar, canToggleSidebar }) {
  return (
    <footer className="pg-footer-bar">
      <button
        type="button"
        className="pg-btn pg-btn-ghost pg-btn-sm pg-footer-toggle"
        onClick={onToggleSidebar}
        disabled={!canToggleSidebar}
        title={canToggleSidebar ? (isSidebarVisible ? 'Hide sidebar' : 'Show sidebar') : 'Sidebar always visible on Dashboard'}
      >
        <i className={`fas ${isSidebarVisible ? 'fa-angle-left' : 'fa-bars'}`} />
        {isSidebarVisible ? 'Hide menu' : 'Show menu'}
      </button>
      <span>© Notes</span>
      <span className="pg-footer-separator">|</span>
      <span>Paths Games Admin Panel</span>
      <span className="pg-footer-separator">|</span>
      <span>Version: 0.17.2</span>
    </footer>
  )
}

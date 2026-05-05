export default function BookWrapper({ children, onClose, className = '' }) {
  return (
    <div className="book-overlay">
      <div className={`book-wrapper ${className}`}>
        {onClose && (
          <button className="book-close-btn" onClick={onClose} title="Close">
            <i className="fas fa-times" />
          </button>
        )}
        <div className="book-spine" />
        {children}
      </div>
    </div>
  )
}

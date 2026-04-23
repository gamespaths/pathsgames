export default function ConfirmModal({ title, message, onConfirm, onCancel, danger = true }) {
  return (
    <div className="pg-modal-backdrop" onClick={onCancel}>
      <div className="pg-modal" onClick={e => e.stopPropagation()}>
        <p className="pg-modal-title">
          {danger ? <i className="fas fa-exclamation-triangle text-red-400 me-2" /> : <i className="fas fa-question-circle me-2" />}
          {title}
        </p>
        <p className="mb-4" style={{ fontSize: '0.95rem', color: 'var(--color-parchment)' }}>{message}</p>
        <div className="flex gap-2 justify-end">
          <button className="pg-btn pg-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`pg-btn ${danger ? 'pg-btn-danger' : 'pg-btn-gold'}`} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

export default function ErrorAlert({ message, onClose }) {
  if (!message) return null
  return (
    <div className="pg-alert pg-alert-danger mb-4">
      <i className="fas fa-exclamation-triangle mt-0.5 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
          <i className="fas fa-times" />
        </button>
      )}
    </div>
  )
}

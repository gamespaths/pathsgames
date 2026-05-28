export default function LoadingSpinner({ text = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 py-8 justify-center">
      <span className="pg-spinner" />
      <span className="text-sm" style={{ color: 'var(--color-ash)' }}>{text}</span>
    </div>
  )
}

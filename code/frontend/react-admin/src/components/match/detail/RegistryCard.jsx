/**
 * RegistryCard — the match registry (gaming_state_registry): key + the SET of values it holds.
 * Step 36.1 — a multi-valued key owns several values, so the column shows the whole set.
 */
export default function RegistryCard({ registry }) {
  const rows = registry ?? []
  return (
    <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
      <p className="pg-card-title" style={{ padding: '0.75rem 1rem 0' }}>
        <i className="fas fa-list me-1" />Registry ({rows.length})
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="pg-table" style={{ fontSize: '0.78rem' }}>
          <thead><tr><th>Key</th><th>Values</th><th>Multi</th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No registry entries.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.uuid ?? r.key}>
                <td>{r.key}</td>
                <td style={{ wordBreak: 'break-all' }}>
                  {(r.values ?? []).length === 0 ? '—' : (r.values ?? []).join(', ')}
                </td>
                <td>{r.multiValue ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Step 40 — the build's environment code as a header badge; react-admin has no i18n.
const LABELS = { dev: 'Local', test: 'Test', alpha: 'Alpha', beta: 'Beta' }

/** Known code → English label, unknown → upper case, empty or `prod` → nothing. */
export function envBadgeLabel(code) {
  const env = String(code ?? '').trim().toLowerCase()
  if (!env || env === 'prod') return null
  return LABELS[env] ?? env.toUpperCase()
}

export default function EnvBadge({ code = import.meta.env?.VITE_ENV_BADGE ?? '' }) {
  const label = envBadgeLabel(code)
  if (!label) return null
  return <span className="pg-env-badge" data-testid="env-badge" title={label}>{label}</span>
}

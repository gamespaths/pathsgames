import { useTranslation } from '../../i18n/context'
import { usePolicyBook } from '../../context/PolicyBookContext'
import { ENV_BADGE } from '../../constants/features'

/**
 * EnvBadge — Step 40: the environment code of the build as a translated header label
 * (envBadge.<code>); an unknown code shows upper-cased, empty or `prod` shows nothing.
 * The whole badge is a button: it opens the Devlog book, as the footer Devlog link does.
 */
export default function EnvBadge({ code = ENV_BADGE }) {
  const { t } = useTranslation()
  const { openPolicyBook } = usePolicyBook()
  const label = envBadgeLabel(code, t)
  if (!label) return null
  const env = String(code).trim().toLowerCase()
  const devlogLabel = `${label} — ${t('footer.devlog')}`
  return (
    <button
      type="button"
      className={`env-badge env-badge--${env}`}
      data-testid="env-badge"
      title={devlogLabel}
      aria-label={devlogLabel}
      onClick={() => openPolicyBook('roadmap')}
    >
      <i className="fas fa-info-circle env-badge__icon" aria-hidden="true" />
      {label}
    </button>
  )
}

/** The badge text for an env code, or null when no badge shows (empty or `prod`). */
export function envBadgeLabel(code, t) {
  const env = String(code ?? '').trim().toLowerCase()
  if (!env || env === 'prod') return null
  const key = `envBadge.${env}`
  const translated = t(key)
  return translated === key ? env.toUpperCase() : translated
}

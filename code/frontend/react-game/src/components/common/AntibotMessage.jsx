import { useTranslation } from '../../i18n/context'

/** Shown when Turnstile flags the visitor as a bot. */
export default function AntibotMessage() {
  const { t } = useTranslation()
  return (
    <div className="antibot-message">
      <i className="fas fa-robot antibot-message-icon" />
      <p>{t('antibot.blocked')}</p>
    </div>
  )
}

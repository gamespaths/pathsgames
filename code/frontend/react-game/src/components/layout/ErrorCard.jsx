import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { buildErrorCard } from '@/utils/loadoutCards'

/**
 * ErrorCard — v1.13.0: the fixed "error" card as the book's right page (no overlay); back and close call `onClose`.
 * An API `message` wins over the match-not-running text; status 'ENDED' appends the match-ended note.
 */
export default function ErrorCard({ status, message, onClose }) {
  const { t } = useTranslation()

  const card = buildErrorCard(t)
  card.description = message
    ? message
    : status === 'ENDED'
      ? `${t('errors.matchNotRunning')} ${t('errors.matchEnded')}`
      : t('errors.matchNotRunning')
  return (
    <Card variant="page"
      card={card}
      entityType="error"
      onClose={onClose}
      onAction={onClose}
      actionLabel={t('modals.close')}
      actionIcon="fa-times"
    />
  )
}

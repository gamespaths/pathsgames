import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { buildErrorCard } from '@/utils/loadoutCards'

/**
 * ErrorCard — the match-error page, LoadingCard's sibling: the fixed "error"
 * card from data/images.json (via buildErrorCard) rendered as a book page
 * Card. It floats on its own overlay ABOVE the book (.book-overlay is
 * z-index 1050), so transient gameplay errors stay visible over the open
 * board; the back arrow and the close action both call `onClose`.
 *
 * A specific API error `message` (e.g. the INSUFFICIENT_ENERGY detail) takes
 * precedence over the generic match-not-running text; status 'ENDED' appends
 * the match-ended note.
 *
 * `maxWidth` (a CSS size, e.g. "400px") caps the card's width inside the
 * overlay; unset, the card fills all the available space (see LoadingCard).
 */
export default function ErrorCard({ status, message, onClose, maxWidth = null }) {
  const { t } = useTranslation()
  
  const card = buildErrorCard(t)
  card.description = message
    ? message
    : status === 'ENDED'
      ? `${t('errors.matchNotRunning')} ${t('errors.matchEnded')}`
      : t('errors.matchNotRunning')
  return (
    <div className="error-card-overlay" data-testid="error-card-overlay">
      <div style={maxWidth ? { width: '100%', maxWidth } : { width: '100%' }}>
        <Card variant="page"
          card={card}
          entityType="error"
          onClose={onClose}
          onAction={onClose}
          actionLabel={t('modals.close')} 
          actionIcon="fa-xmark"
        />
      </div>
    </div>
  )
}

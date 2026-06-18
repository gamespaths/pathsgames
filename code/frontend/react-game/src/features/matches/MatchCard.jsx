import { useTranslation } from '../../i18n/context'
import Card from '../../components/layout/Card'

const RESUMABLE = new Set(['CREATED', 'RUNNING'])

/**
 * MatchCard — small card for a user's match in the profile book.
 *
 * Active match (CREATED/RUNNING): shows (i) + Resume button.
 * Terminal match (PAUSED/ENDED/GAMEOVER): shows (i) + status badge only.
 *
 * onPreviewCard(infoObj) — called when (i) is clicked; parent (GuestUserModal)
 * renders the full card on the book's left page.
 */
export default function MatchCard({ match, story, onResume, onPreviewCard }) {
  const { t } = useTranslation()

  const status    = match?.status ?? ''
  const resumable = RESUMABLE.has(status)
  const card      = story?.card ?? null
  const name      = story?.title ?? t('matches.unknownStory')

  const statusLabel = t(`matches.status.${status}`) || status

  const handlePreview = () => {
    if (!onPreviewCard) return
    onPreviewCard({
      card,
      story,
      statusLabel,
      match,
    })
  }

  return (
    <div className="match-card-wrap">
      <Card
        variant="little"
        card={card}
        name={name}
        icon="fas fa-book-open"
        onSelect={resumable ? onResume : undefined}
        selectLabel={t('matches.resume')}
        onPreview={handlePreview}
        locked={!resumable}
        lockedIcon="fas fa-check-circle"
        label={resumable ? null : statusLabel}
      >
        {/* status badge on non-resumable cards */}
        {/*!resumable && (
          <div className="match-status-overlay">
            <span className="match-status-label">{statusLabel}</span>
          </div>
        )*/}
      </Card>
    </div>
  )
}

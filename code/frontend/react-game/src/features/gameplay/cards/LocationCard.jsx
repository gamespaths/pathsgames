import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'

/**
 * LocationCard — current-location card shown on the left book page.
 *
 * Delegates the layout (title bar, image/icon, parchment footer) to Card
 * variant="big". The description is rendered just below the Card since
 * Card's footer is reserved for action/info buttons.
 *
 * Step 26 — when the location carries a residual time counter
 * (`location.clockCounter` > 0) it is shown as a statistic badge on the page,
 * styled like the other in-game statistics.
 *
 * Renders nothing when no location is available — the parent (GameBook) is
 * responsible for falling back to the story big card in that case.
 */
export default function LocationCard({ location , card , story , locationsActive }) {
  const { t } = useTranslation()
  if (!location) return null

  const counter = Number(location.clockCounter)
  const statItems = Number.isFinite(counter) && counter > 0
    ? [{ key: 'clockCounter', label: t('game.location.clockCounter'), value: counter }]
    : null

  return (
    <div className="game-location-card-wrap">
      <Card variant="page"
        entity="location"
        card={card}
        icon={card?.awesomeIcon ?? 'fas fa-map-marker-alt'}
        story={story}
        imageAlt={location.name}
        statItemsToPageContent={statItems}
      />
      {/*location.description && (
        <p className="game-loc-desc">{location.description}</p>
      )*/}
    </div>
  )
}

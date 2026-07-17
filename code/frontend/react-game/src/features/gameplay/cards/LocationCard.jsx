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
 *
 * `onEnterLocation` (optional) — when supplied, a right-edge arrow button is
 * shown that leaves the map view and enters the play view of this location
 * (used on the map's right page when the selected location is the character's
 * own current location).
 */
export default function LocationCard({ location , card , story , locationsActive , onEnterLocation ,loading = false}) {
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
        card={card} entityType="location"
        icon={card?.awesomeIcon ?? 'fas fa-map-marker-alt'}
        story={story}
        imageAlt={location.name}
        statItemsToPageContent={statItems}
        onForward={onEnterLocation}
        loading={loading}
      />
    </div>
  )
}

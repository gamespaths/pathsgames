import GameCard from '../../components/layout/GameCard'

/**
 * LocationCard — current-location card shown on the left book page.
 *
 * Delegates the layout (title bar, image/icon, parchment footer) to GameCard
 * variant="big". The description is rendered just below the GameCard since
 * GameCard's footer is reserved for action/info buttons.
 *
 * Renders nothing when no location is available — the parent (GameBook) is
 * responsible for falling back to the story big card in that case.
 */
export default function LocationCard({ location }) {
  if (!location) return null

  return (
    <div className="game-location-card-wrap">
      <GameCard
        variant="big"
        card={location}
        icon={location.awesomeIcon ?? 'fas fa-map-marker-alt'}
        imageAlt={location.name}
      />
      {location.description && (
        <p className="game-loc-desc">{location.description}</p>
      )}
    </div>
  )
}

import { useTranslation } from '../../i18n/context'
import GameCardInfoButton from '../../components/layout/GameCardInfoButton'

export default function LocationCard({ location }) {
  const { t } = useTranslation()

  if (!location) return null

  return (
    <div className="pg-card pg-card--large game-location-card" style={{ position: 'relative' }}>
      <div className="game-loc-img-wrap">
        <img src={location.imageUrl} alt={location.name} className="game-loc-img" />
      </div>
      <div className="game-loc-body">
        <h4 className="game-loc-name">{location.name}</h4>
        <p className="game-loc-desc">{location.description}</p>
      </div>
      {location.copyrightText && (
        <GameCardInfoButton card={location} />
      )}
    </div>
  )
}

import { useTranslation } from '../../i18n/context'

export default function LocationCard({ location }) {
  const { t } = useTranslation()

  if (!location) return null

  const copyrightModalId = `loc-copyright-${location.uuid}`

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
        <button
          className="card-info-btn"
          data-bs-toggle="modal"
          data-bs-target={`#${copyrightModalId}`}
          title="Photo credit"
        >
          <i className="fas fa-info-circle" />
        </button>
      )}
    </div>
  )
}

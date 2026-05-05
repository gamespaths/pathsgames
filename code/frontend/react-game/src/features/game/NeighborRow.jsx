import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import CardDetailModal from './CardDetailModal'

export default function NeighborRow({ locations }) {
  const { t } = useTranslation()
  const [activeLocation, setActiveLocation] = useState(null)

  return (
    <>
      <div className="game-section-label">
        <i className="fas fa-arrows-alt me-2" />{t('game.moveTo')}
      </div>

      <div className="game-cards-row">
        {locations.map((loc, i) => {
          const modalId = `neighbor-modal-${loc.uuid ?? i}`
          return (
            <div key={loc.uuid ?? i}>
              <div
                className="pg-card pg-card--medium game-card"
                data-bs-toggle="modal"
                data-bs-target={`#${modalId}`}
                onClick={() => setActiveLocation(loc)}
              >
                {loc.imageUrl ? (
                  <img src={loc.imageUrl} alt={loc.name} className="game-card-img" />
                ) : (
                  <div className="game-card-icon"><i className={loc.awesomeIcon ?? 'fas fa-map-marker-alt'} /></div>
                )}
                <div className="game-card-name">{loc.name}</div>
              </div>
              <CardDetailModal
                card={loc}
                modalId={modalId}
                actionLabel={t('game.move')}
                onAction={() => console.log('Move to', loc.name)}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

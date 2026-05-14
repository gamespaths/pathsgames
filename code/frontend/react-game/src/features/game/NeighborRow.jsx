import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import CardDetailModal from './CardDetailModal'

function sanitizeModalId(value, fallback) {
  const raw = String(value ?? fallback)
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '')
  return safe || String(fallback)
}

function sanitizeIconClass(iconClass, fallback) {
  if (typeof iconClass !== 'string') return fallback
  const normalized = iconClass.trim()
  const valid = /^[a-zA-Z0-9\s_-]+$/.test(normalized)
  return valid && normalized.length > 0 ? normalized : fallback
}

function sanitizeurlImage(urlImage) {
  if (typeof urlImage !== 'string' || !urlImage.trim()) return null

  const value = urlImage.trim()
  if (value.startsWith('/')) return value

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

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
          const modalId = `neighbor-modal-${sanitizeModalId(loc.uuid, i)}`
          const urlImage = sanitizeurlImage(loc.urlImage)
          const iconClass = sanitizeIconClass(loc.awesomeIcon, 'fas fa-map-marker-alt')
          return (
            <div key={loc.uuid ?? i}>
              <div
                className="pg-card pg-card--medium game-card"
                data-bs-toggle="modal"
                data-bs-target={`#${modalId}`}
                onClick={() => setActiveLocation(loc)}
              >
                {urlImage ? (
                  <img src={urlImage} alt={loc.name} className="game-card-img" />
                ) : (
                  <div className="game-card-icon"><i className={iconClass} /></div>
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

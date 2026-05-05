import { createPortal } from 'react-dom'
import { useTranslation } from '../../i18n/context'
import CopyrightModal from '../../components/modals/CopyrightModal'

export default function CardDetailModal({ card, modalId, actionLabel, onAction }) {
  const { t } = useTranslation()
  const copyrightModalId = `${modalId}-copyright`

  if (!card) return null

  return createPortal(
    <>
      <div className="modal fade" id={modalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {card.awesomeIcon && <i className={`${card.awesomeIcon} me-2`} />}
                {card.name}
              </h5>
              <button type="button" className="modal-custom-close" data-bs-dismiss="modal">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body">
              {card.imageUrl ? (
                <img src={card.imageUrl} alt={card.name} className="card-detail-img" />
              ) : (
                <div style={{
                  width: '100%',
                  height: 120,
                  background: 'var(--card-header-background)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <i className={`${card.awesomeIcon ?? 'fas fa-map-marker-alt'}`} style={{ fontSize: '2.5rem', color: 'var(--color-gold-light)' }} />
                </div>
              )}
              <h4 className="card-detail-title">{card.name}</h4>
              <p className="card-detail-desc">{card.description}</p>
              {card.copyrightText && (
                <div style={{ textAlign: 'right' }}>
                  <button
                    className="card-info-btn"
                    style={{ position: 'static', display: 'inline-flex' }}
                    data-bs-toggle="modal"
                    data-bs-target={`#${copyrightModalId}`}
                  >
                    <i className="fas fa-info-circle" />
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary-pg" data-bs-dismiss="modal">
                {t('modals.close')}
              </button>
              <button
                type="button"
                className="btn-action"
                data-bs-dismiss="modal"
                onClick={onAction}
              >
                <i className="fas fa-arrow-right me-2" />{actionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <CopyrightModal cardInfo={card} modalId={copyrightModalId} />
    </>,
    document.body
  )
}

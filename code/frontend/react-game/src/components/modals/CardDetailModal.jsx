import { createPortal } from 'react-dom'
import { useTranslation } from '../../i18n/context'

//note: this component is NOT used but beatiful and maybe useful in the future for a more detailed card view, so I left it here for now instead of deleting it. It is used by SelectionView for the "info" button of each option, but currently the button is hidden until we have more content to show in the modal.
/*
  const openModal = (modalId) => {
    if (typeof window === 'undefined') return
    const el = document.getElementById(modalId)
    if (!el) return
    const Modal = window.bootstrap?.Modal
    if (Modal) Modal.getOrCreateInstance(el).show()
  }

    onPreview={() => openModal(modalId)}
              <CardDetailModal
                card={opt}
                modalId={modalId}
                actionLabel={selectText}
                onAction={() => handleAction(opt)}
              />
*/
export default function CardDetailModal({ card, modalId, actionLabel, onAction }) {
  const { t } = useTranslation()

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
              {card.urlImage ? (
                <img src={card.urlImage} alt={card.name} className="card-detail-img" />
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

            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary-pg" data-bs-dismiss="modal">
                {t('modals.close')}
              </button>
              {onAction && <button
                type="button"
                className="btn-action"
                data-bs-dismiss="modal"
                onClick={onAction}
              >
                <i className="fas fa-arrow-right me-2" />{actionLabel}
              </button>}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

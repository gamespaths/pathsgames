import { createPortal } from 'react-dom'
import { useTranslation } from '../../i18n/context'

function CreditCard({ credit }) {
  const hasImage = !!credit.imageUrl
  return (
    <div className={`credits-card${credit.disabled ? ' credits-card--disabled' : ''}`}>
      {hasImage ? (
        <img src={credit.imageUrl} alt={credit.name} className="credits-card-img" />
      ) : (
        <div className="credits-card-placeholder">
          <i className={`${credit.icon ?? 'fas fa-image'} credits-card-placeholder-icon`} />
        </div>
      )}
      <div className="credits-card-overlay">
        {credit.label && <div className="credits-card-label">{credit.label}</div>}
        <div className="credits-card-name">{credit.name ?? '—'}</div>
        {credit.linkCopyright && (
          <a href={credit.linkCopyright} target="_blank" rel="noopener noreferrer" className="credits-view-btn">
            <i className="fas fa-external-link-alt me-1" />View original
          </a>
        )}
      </div>
    </div>
  )
}

export default function CopyrightModal({ cardInfo, modalId = 'copyrightModal' }) {
  const { t } = useTranslation()

  if (!cardInfo) return null

  const credits = [
    {
      label: 'Image',
      imageUrl: cardInfo.imageUrl,
      name: cardInfo.copyrightText ?? cardInfo.title,
      linkCopyright: cardInfo.linkCopyright,
    },
    { label: 'Text',  icon: 'fas fa-font',  name: 'Coming soon', disabled: true },
    { label: 'Sound', icon: 'fas fa-music', name: 'Coming soon', disabled: true },
  ]

  return createPortal(
    <div className="modal fade" id={modalId} tabIndex="-1" aria-hidden="true">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-star me-2" />Crediti
            </h5>
            <button type="button" className="modal-custom-close" data-bs-dismiss="modal">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body">
            <div className="credits-list">
              {credits.map(c => <CreditCard key={c.label} credit={c} />)}
            </div>
          </div>
          <div className="modal-footer" style={{ justifyContent: 'center' }}>
            <button type="button" className="modal-close-btn" data-bs-dismiss="modal">
              <i className="fas fa-arrow-left me-2" />{t('modals.close')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

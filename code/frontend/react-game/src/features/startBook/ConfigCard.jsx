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
          <i className={`${credit.icon ?? 'fas fa-question'} credits-card-placeholder-icon`} />
          <span className="credits-card-placeholder-text">Coming soon</span>
        </div>
      )}
      <div className="credits-card-overlay">
        {credit.label && <div className="credits-card-label">{credit.label}</div>}
        <div className="credits-card-name">{credit.name ?? '—'}</div>
        {credit.linkCopyright && !credit.disabled && (
          <a href={credit.linkCopyright} target="_blank" rel="noopener noreferrer" className="credits-view-btn">
            <i className="fas fa-external-link-alt me-1" />View original
          </a>
        )}
      </div>
    </div>
  )
}

function InfoButton({ value, type, story }) {
  if (!value?.card?.imageUrl) return null

  const modalId = `cfgInfoModal_${value.uuid ?? type}`

  const credits = [
    story?.card?.imageUrl ? {
      label: 'Story',
      imageUrl: story.card.imageUrl,
      name: story.author,
      linkCopyright: story.card.linkCopyright
    } : null,
    {
      label: 'Image',
      imageUrl: value.card.imageUrl,
      name: value.card.copyrightText ?? value.name,
      linkCopyright: value.card.linkCopyright
    },
    { label: 'Text',  icon: 'fas fa-font',  name: 'Coming soon', disabled: true },
    { label: 'Sound', icon: 'fas fa-music', name: 'Coming soon', disabled: true },
  ].filter(Boolean)

  return (
    <>
      <button
        className="card-info-btn config-info-btn"
        data-bs-toggle="modal"
        data-bs-target={`#${modalId}`}
        onClick={e => e.stopPropagation()}
        aria-label="Credits"
      >
        <i className="fas fa-info-circle" />
      </button>
      {createPortal(
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
                  <i className="fas fa-arrow-left me-2" />Go back
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default function ConfigCard({ type, value, locked, selected, story, onChangeClick, onSelect }) {
  const { t } = useTranslation()

  const labelKey = `book.${type}`

  let actionBtn
  if (locked) {
    actionBtn = (
      <span className="config-coming-soon-btn">
        <i className="fas fa-lock me-1" />Coming soon
      </span>
    )
  } else if (onSelect) {
    actionBtn = (
      <button className="config-change-btn" onClick={onSelect}>
        <i className="fas fa-check me-1" />{t('book.select')}
      </button>
    )
  } else {
    actionBtn = (
      <button className="config-change-btn" onClick={onChangeClick}>
        <i className="fas fa-sync-alt me-1" />{t('book.change')}
      </button>
    )
  }

  if (value?.card?.imageUrl) {
    const styleMain   = value.card.style_main   ?? ''
    const styleDetail = value.card.style_detail ?? ''
    return (
      <div className={`pg-card pg-card--grid config-card-cover ${locked ? 'config-card-disabled' : ''} ${selected ? 'config-card-selected' : ''} ${styleMain}`.trimEnd()}>
        <img src={value.card.imageUrl} alt={value.name} className={`config-cover-img ${styleDetail}`.trimEnd()} />
        <div className="config-cover-badge">{t(labelKey)}</div>
        <InfoButton value={value} type={type} story={story} />
        <div className="config-cover-footer">
          <div className="config-cover-name">
            <i className={`${value.icon ?? 'fas fa-question'} me-1`} />
            {value.name ?? '—'}
          </div>
          {actionBtn}
        </div>
      </div>
    )
  }

  return (
    <div className={`pg-card pg-card--grid config-card ${locked ? 'config-card-disabled' : ''} ${selected ? 'config-card-selected' : ''}`}>
      <div className="config-card-label">{t(labelKey)}</div>
      <div className="config-card-icon">
        <i className={value?.icon ?? 'fas fa-question'} />
      </div>
      <div className="config-card-value">{value?.name ?? '—'}</div>
      {actionBtn}
    </div>
  )
}

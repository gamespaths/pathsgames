import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../i18n/context'
import GameCard from './GameCard'

/**
 * Self-contained (i) button + credits modal portal.
 *
 * Props:
 *   card           — card object: imageUrl (or url), copyrightText, linkCopyright, title/name
 *   story          — optional story for a "Story" credit row (story.card.imageUrl, story.author)
 *   modalId        — optional stable id; auto-generated if omitted
 *   buttonClassName — CSS class for the button (default: "card-info-btn config-info-btn")
 *   buttonStyle    — optional inline styles for the button
 *
 * Returns null if card has neither imageUrl/url nor copyrightText.
 */
export default function GameCardInfoButton({
  card,
  story = null,
  modalId,
  buttonClassName = 'card-info-btn config-info-btn',
  buttonStyle,
  showModalFooter=false,
}) {
  const { t } = useTranslation()
  const autoId = useRef(`gc_cred_${Math.random().toString(36).slice(2, 8)}`).current
  const id = modalId ?? autoId

  const imageUrl = card?.imageUrl ?? card?.url ?? null

  if (!imageUrl && !card?.copyrightText) return null

  const credits = [
    story?.card?.imageUrl ? {
      label: 'Story',
      imageUrl: story.card.imageUrl,
      name: story.author,
      linkCopyright: story.card.linkCopyright,
    } : null,
    {
      label: 'Image',
      imageUrl,
      icon: imageUrl ? undefined : 'fas fa-image',
      name: card.copyrightText ?? card.title ?? card.name,
      linkCopyright: card.linkCopyright,
      disabled: !imageUrl,
    },
    { label: 'Text',  icon: 'fas fa-font',  name: 'Coming soon', disabled: true },
    { label: 'Sound', icon: 'fas fa-music', name: 'Coming soon', disabled: true },
  ].filter(Boolean)

  return (
    <>
      <button
        className={buttonClassName}
        style={buttonStyle}
        data-bs-toggle="modal"
        data-bs-target={`#${id}`}
        onClick={e => e.stopPropagation()}
        aria-label="Credits"
      >
        <i className="fas fa-info-circle" />
      </button>
      {createPortal(
        <div className="modal fade" id={id} tabIndex="-1" aria-hidden="true">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="fas fa-star me-2" />Crediti</h5>
                <button type="button" className="modal-custom-close" data-bs-dismiss="modal">
                  <i className="fas fa-times" />
                </button>
              </div>
              <div className="modal-body">
                <div className="credits-list">
                  {credits.map(c => (
                    <GameCard
                      key={c.label}
                      label={c.label}
                      imageUrl={c.imageUrl}
                      icon={c.icon}
                      name={c.name}
                      linkCopyright={c.linkCopyright}
                      disabled={c.disabled}
                      showLinkCopyright={true}
                    />
                  ))}
                </div>
              </div>
              {showModalFooter && (
                <div className="modal-footer" style={{ justifyContent: 'center' }}>
                  <button type="button" className="modal-close-btn" data-bs-dismiss="modal">
                    <i className="fas fa-arrow-left me-2" />{t('modals.close')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

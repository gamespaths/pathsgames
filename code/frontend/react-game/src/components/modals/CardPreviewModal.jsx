import { createPortal } from 'react-dom'
import { useTranslation } from '../../i18n/context'
import Card from '../layout/Card'

/**
 * CardPreviewModal — mobile "big card" preview.
 *
 * On desktop the (i) lens swaps the book's left page; on mobile there is no
 * left page, so the same preview is shown here in a Bootstrap modal. Mounted
 * once by StartBookModal and opened via the window.bootstrap Modal API on
 * #cardPreviewModal whenever an (i) button is pressed.
 */
export default function CardPreviewModal({ preview, story }) {
  const { t } = useTranslation()
//console.log("CardPreviewModal preview",preview);
  return createPortal(
    <div className="modal fade" id="cardPreviewModal" tabIndex="-1" aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content card-preview-modal-content">
          <button
            type="button"
            className="modal-custom-close card-preview-modal-close"
            data-bs-dismiss="modal"
            aria-label={t('modals.close')}
          >
            <i className="fas fa-times" />
          </button>
          <div className="modal-body card-preview-modal-body">
            {preview && (
              <Card variant="page"
                card={preview?.entity?.card ?? preview?.card ?? preview?.entity}
                entity={preview?.entity}
                entityType={preview?.type}
                statItemsToPageContent={preview?.statItemsToPageContent}
                story={story} 
                loading={false} {...preview?.additionalProps}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

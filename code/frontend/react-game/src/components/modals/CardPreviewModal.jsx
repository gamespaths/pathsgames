import { createPortal } from 'react-dom'
import { useTranslation } from '../../i18n/context'
import BookPageContent from '../book/BookPageContent'

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
              <BookPageContent
                card={preview.entity?.card}
                entity={preview.entity}
                entityType={preview.type}
                story={story}
                loading={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

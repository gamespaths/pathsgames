import { useTranslation } from '../../i18n/context'
import { useGuestUser } from '../../context/GuestUserContext'
import BookPageContent from '../book/BookPageContent'

/**
 * GuestUserModal — shows the current guest identity as a BookPageContent card.
 *
 * Title:        guest username
 * Description:  i18n `modals.guestUser.body` (HTML, rendered with the same
 *               dangerouslySetInnerHTML path used for stories). Includes a
 *               placeholder text about played matches until match history is
 *               wired up.
 *
 * Triggered from `Navbar.jsx` (`data-bs-target="#guestUserModal"`).
 */
export default function GuestUserModal() {
  const { t } = useTranslation()
  const { user, loading } = useGuestUser()

  const username = user?.username ?? t('modals.guestUser.anonymous')
  const description = t('modals.guestUser.body')

  const card = {
    title: username,
    description,
    urlImage: null,
    linkCopyright: null,
  }

  return (
    <div className="modal fade" id="guestUserModal" tabIndex="-1" aria-hidden="true">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-user-circle me-2" />{t('modals.guestUser.title')}
            </h5>
            <button type="button" className="modal-custom-close" data-bs-dismiss="modal">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body">
            <BookPageContent card={card} loading={loading} />
            {/*user?.userUuid && (
              <p className="guest-user-uuid">
                <i className="fas fa-fingerprint me-1" />
                <span>{t('modals.guestUser.uuidLabel')}:</span> <code>{user.userUuid}</code>
              </p>
            )*/}
          </div>
          <div className="modal-footer">
            <button type="button" className="modal-close-btn" data-bs-dismiss="modal">
              {t('modals.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

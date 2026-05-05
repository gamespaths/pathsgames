import { useTranslation } from '../../i18n/context'

export default function CookiesModal() {
  const { t } = useTranslation()

  return (
    <div className="modal fade" id="cookiePolicyModal" tabIndex="-1" aria-hidden="true">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-cookie-bite me-2" />{t('modals.cookies.title')}
            </h5>
            <button type="button" className="modal-custom-close" data-bs-dismiss="modal">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
            <p>{t('modals.cookies.body')}</p>
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

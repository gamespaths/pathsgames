import { useTranslation } from '../../i18n/context'
import { openCookiePreferences } from '../../consent/cookieConsent'

const SECTIONS = [
  ['necessaryTitle', 'necessaryBody'],
  ['analyticsTitle', 'analyticsBody'],
  ['legalTitle', 'legalBody'],
  ['manageTitle', 'manageBody'],
  ['thirdPartyTitle', 'thirdPartyBody'],
  ['rightsTitle', 'rightsBody'],
]

export default function CookiesModal() {
  const { t } = useTranslation()

  return (
    <div className="modal fade" id="cookiePolicyModal" tabIndex="-1" aria-hidden="true">
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
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
            <p>{t('modals.cookies.intro')}</p>
            {SECTIONS.map(([titleKey, bodyKey]) => (
              <div key={titleKey}>
                <h6 style={{ color: 'var(--color-gold)', marginTop: '1rem' }}>
                  {t(`modals.cookies.${titleKey}`)}
                </h6>
                <p>{t(`modals.cookies.${bodyKey}`)}</p>
              </div>
            ))}
            <p style={{ fontStyle: 'italic', marginTop: '1rem' }}>{t('modals.cookies.updated')}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="modal-close-btn" data-bs-dismiss="modal" onClick={openCookiePreferences}>
              {t('modals.cookies.manage')}
            </button>
            <button type="button" className="modal-close-btn" data-bs-dismiss="modal">
              {t('modals.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

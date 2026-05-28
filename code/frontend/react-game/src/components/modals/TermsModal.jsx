import { useTranslation } from '../../i18n/context'

const SECTIONS = [
  ['acceptanceTitle', 'acceptanceBody'],
  ['serviceTitle', 'serviceBody'],
  ['guestTitle', 'guestBody'],
  ['useTitle', 'useBody'],
  ['ipTitle', 'ipBody'],
  ['disclaimerTitle', 'disclaimerBody'],
  ['liabilityTitle', 'liabilityBody'],
  ['availabilityTitle', 'availabilityBody'],
  ['thirdPartyTitle', 'thirdPartyBody'],
  ['privacyRefTitle', 'privacyRefBody'],
  ['lawTitle', 'lawBody'],
  ['changesTitle', 'changesBody'],
]

export default function TermsModal() {
  const { t } = useTranslation()

  return (
    <div className="modal fade" id="termsModal" tabIndex="-1" aria-hidden="true">
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-scroll me-2" />{t('modals.terms.title')}
            </h5>
            <button type="button" className="modal-custom-close" data-bs-dismiss="modal">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
            <p><strong style={{ color: 'var(--color-gold-light)' }}>Paths Games</strong> &copy; paths.games</p>
            <p>{t('modals.terms.intro')}</p>
            {SECTIONS.map(([titleKey, bodyKey]) => (
              <div key={titleKey}>
                <h6 style={{ color: 'var(--color-gold)', marginTop: '1rem' }}>
                  {t(`modals.terms.${titleKey}`)}
                </h6>
                <p>{t(`modals.terms.${bodyKey}`)}</p>
              </div>
            ))}
            <p style={{ fontStyle: 'italic', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              {t('modals.terms.updated')}
            </p>
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

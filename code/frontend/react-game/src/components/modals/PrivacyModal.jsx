import { useTranslation } from '../../i18n/context'

const SECTIONS = [
  ['controllerTitle', 'controllerBody'],
  ['dataTitle', 'dataBody'],
  ['purposesTitle', 'purposesBody'],
  ['cookiesTitle', 'cookiesBody'],
  ['sharingTitle', 'sharingBody'],
  ['transfersTitle', 'transfersBody'],
  ['retentionTitle', 'retentionBody'],
  ['rightsTitle', 'rightsBody'],
  ['childrenTitle', 'childrenBody'],
  ['securityTitle', 'securityBody'],
  ['changesTitle', 'changesBody'],
]

export default function PrivacyModal() {
  const { t } = useTranslation()

  return (
    <div className="modal fade" id="privacyPolicyModal" tabIndex="-1" aria-hidden="true">
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-shield-alt me-2" />{t('modals.privacy.title')}
            </h5>
            <button type="button" className="modal-custom-close" data-bs-dismiss="modal">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
            <p><strong style={{ color: 'var(--color-gold-light)' }}>Paths Games</strong> &copy; paths.games</p>
            <p>{t('modals.privacy.intro')}</p>
            {SECTIONS.map(([titleKey, bodyKey]) => (
              <div key={titleKey}>
                <h6 style={{ color: 'var(--color-gold)', marginTop: '1rem' }}>
                  {t(`modals.privacy.${titleKey}`)}
                </h6>
                <p>{t(`modals.privacy.${bodyKey}`)}</p>
              </div>
            ))}
            <p style={{ fontStyle: 'italic', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              {t('modals.privacy.updated')}
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

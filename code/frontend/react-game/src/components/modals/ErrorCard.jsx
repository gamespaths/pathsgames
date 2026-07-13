import { useEffect } from 'react'
import { useTranslation } from '../../i18n/context'
import CardDetailModal from './CardDetailModal'

const MODAL_ID = 'error-card-match-modal'

export default function ErrorCard({ status, message, onClose }) {
  const { t } = useTranslation()

  useEffect(() => {
    const el = document.getElementById(MODAL_ID)
    if (!el) return
    const BootstrapModal = window.bootstrap?.Modal
    if (!BootstrapModal) return
    const instance = BootstrapModal.getOrCreateInstance(el)
    instance.show()
    el.addEventListener('hidden.bs.modal', onClose)
    return () => {
      el.removeEventListener('hidden.bs.modal', onClose)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A specific API error message (e.g. INSUFFICIENT_ENERGY detail) takes precedence
  // over the generic match-not-running text.
  const description = message
    ? message
    : status === 'ENDED'
      ? `${t('errors.matchNotRunning')} ${t('errors.matchEnded')}`
      : t('errors.matchNotRunning')

  const card = {
    awesomeIcon: 'fas fa-exclamation-triangle',
    name: t('errors.title'),
    description,
  }

  return (
    <CardDetailModal
      card={card}
      modalId={MODAL_ID}
      actionLabel={t('modals.close')}
    />
  )
}

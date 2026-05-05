import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import CardDetailModal from './CardDetailModal'

export default function ActionsRow({ actions }) {
  const { t } = useTranslation()
  const [activeAction, setActiveAction] = useState(null)

  return (
    <>
      <div className="game-section-label">
        <i className="fas fa-hand-sparkles me-2" />{t('game.actions')}
      </div>

      <div className="game-cards-row">
        {actions.map((action, i) => {
          const modalId = `action-modal-${action.uuid ?? i}`
          return (
            <div key={action.uuid ?? i}>
              <div
                className="pg-card pg-card--medium game-card"
                data-bs-toggle="modal"
                data-bs-target={`#${modalId}`}
                onClick={() => setActiveAction(action)}
              >
                <div className="game-card-icon">
                  <i className={action.awesomeIcon ?? 'fas fa-bolt'} />
                </div>
                <div className="game-card-name">{action.name}</div>
              </div>
              <CardDetailModal
                card={action}
                modalId={modalId}
                actionLabel={t('game.execute')}
                onAction={() => console.log('Execute', action.name)}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

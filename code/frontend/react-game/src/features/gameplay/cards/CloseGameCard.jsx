import { useEffect, useState } from 'react'
import { useTranslation } from "@/i18n/context"
    import Card from '@/components/layout/Card'



// Close confirmation: the player paused (did not finish) the match.
// `onDismiss` closes the prompt (backdrop click); `onExit` leaves to the home page.
function CloseGameCard({ story, onExit, onDismiss }) {
  const { t } = useTranslation()
  const card = story?.card
  const handleOverlayKey = e => { if (e.key === 'Escape') onDismiss() }
  return <div className="close-prompt-overlay" role="presentation" onClick={onDismiss} onKeyDown={handleOverlayKey}>
    <div className="close-prompt-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <Card
        variant="big"
        card={card}
        story={story}
        hidePreview
        onAction={onExit}
        actionLabel={t('game.exitToHome')}
        actionIcon="fa-home"
      >
        <p className="book-page-desc close-prompt-text">{t('game.closePrompt')}</p>
      </Card>
    </div>
  </div>
}

export default CloseGameCard
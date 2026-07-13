import { useEffect, useState } from 'react'
import { useTranslation } from "@/i18n/context"
    import Card from '@/components/layout/Card'



// Close confirmation: the player paused (did not finish) the match.
// `onDismiss` closes the prompt (backdrop click); `onExit` leaves to the home page.
// When `onBack` is passed the card is rendered as a full book reading page
// (variant="page") with the back arrow top-left — the close overlay shown on the
// book's right page (see GameBook). `onBack` cancels (returns to the game),
// `onExit` still leaves to the home page via the action button.
function CloseGameCard({ story, onExit, onDismiss, onBack = null }) {
  const { t } = useTranslation()
  const card = { ...story?.card }
  card.title= t('game.exitToHome') // override title for the overlay prompt
  card.description = t('game.closePrompt') // override description for the overlay prompt

  // Page (overlay) mode: reading page with the back arrow + "exit to home" action.
  if (onBack) {
    return (
      <Card entityType="exit"
        variant="page"
        card={card}
        story={story}
        loading={false}
        onClose={onBack}
        onAction={onExit}
        actionLabel={t('game.exitToHome')}
        actionIcon="fa-home"
        hidePreview
      ></Card>
    )
  }

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
      ></Card>
    </div>
  </div>
}

export default CloseGameCard
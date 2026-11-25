import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'

// Close confirmation (the match is paused, not finished) as the board's right page; v1.13.0 the only mode.
// `onBack` cancels (returns to the game), `onExit` leaves to the home page via the action button.
function CloseGameCard({ story, onExit, onBack }) {
  const { t } = useTranslation()
  const card = { ...story?.card }
  card.title = t('game.exitToHome')
  card.description = t('game.closePrompt')

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

export default CloseGameCard

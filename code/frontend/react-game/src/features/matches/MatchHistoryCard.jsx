import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'

/**
 * MatchHistoryCard — v0.37.4. The little card that opens a match's history, listed after the
 * match's missions in the profile book: the history is one door among them, not the first page.
 */
export default function MatchHistoryCard({ story = null, onOpen }) {
  const { t } = useTranslation()
  const card = {
    title: t('matches.history'),
    description: t('matches.historyDescription'),
    urlImage: null,
    awesomeIcon: 'fas fa-history',
  }
  return (
    <Card
      card={card}
      entityType="matchlog"
      story={story}
      icon="fas fa-history"
      onAction={onOpen}
      actionLabel={t('matches.historyOpen')}
      actionIcon="fa-history"
      hidePreview
    />
  )
}

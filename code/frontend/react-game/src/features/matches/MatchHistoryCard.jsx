import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { buildHistoryCard } from '@/utils/loadoutCards'

/**
 * MatchHistoryCard — v0.37.4. The little card that opens a match's history, listed after the
 * match's missions in the profile book and (v0.37.7) before the story card on the board's (i)
 * view: one door, the same in both books, drawn from the `history` entry of data/images.json.
 */
export default function MatchHistoryCard({ story = null, onOpen }) {
  const { t } = useTranslation()
  const card = buildHistoryCard(t, t('matches.historyDescription'))
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

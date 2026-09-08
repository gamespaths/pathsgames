import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { buildMissionsCard } from '@/utils/loadoutCards'

/**
 * MissionCard — Step 37. The missions card, in the same two shapes RegistryCard has.
 *
 *   little (default)  the registry card's neighbour in the (i) list, and what the Missions
 *                     bookmark opens.
 *   page              the LEFT reading page while the missions are open; the RIGHT page
 *                     meanwhile lists them (MissionCards).
 *
 * The count is the missions still OPEN — a card reporting "4" with all four closed would be
 * reporting nothing — while the total rides beside it so the closed ones are not invisible.
 */
export default function MissionCard({
  onOpen, onClose, variant = 'little', count = 0, total = 0, story = null,
}) {
  const { t } = useTranslation()
  const card = buildMissionsCard(t)
  const figures = [{ key: 'missions', value: `${count}`, label: t('game.missions.open') }]
  if (total > count) {
    figures.push({ key: 'missionsTotal', value: `${total}`, label: t('game.missions.count') })
  }

  card.description = t('game.missions.description')

  if (variant === 'page') {
    return (
      <Card
        variant="page"
        card={card}
        entityType="missions"
        story={story}
        loading={false}
        onClose={onClose}
        bonusBadgeShowZeros
        hidePreview
      />
    )
  }

  return (
    <Card
      card={card}
      entityType="missions"
      onAction={onOpen}
      actionLabel={t('game.missions.openAction')}
      actionIcon="fa-clipboard-list"
      statistics={figures}
      bonusBadgeShowZeros
    />
  )
}

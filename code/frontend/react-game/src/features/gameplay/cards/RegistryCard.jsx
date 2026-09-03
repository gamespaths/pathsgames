import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { buildRegistryCard } from '@/utils/loadoutCards'

/**
 * RegistryCard — Step 36. The registry card, in two shapes, exactly as ItemsCard is.
 *
 *   little (default)  the backpack card's neighbour in the (i) list: one footer action that
 *                     opens the registry.
 *   page              the LEFT reading page while the registry is open. Its back arrow closes
 *                     it; the RIGHT page meanwhile lists the keys (RegistryCards).
 *
 * The count of visible keys is the one figure both shapes carry, so the number read before
 * opening is the number still shown after.
 */
export default function RegistryCard({
  onOpen, onClose, variant = 'little', count = 0, story = null,
}) {
  const { t } = useTranslation()
  const card = buildRegistryCard(t)
  // A registry with nothing in it is exactly the state worth reporting, so the badge is
  // rendered with showZeros — same reasoning as the empty backpack.
  const figures = [{ key: 'registry', value: `${count}`, label: t('game.registry.count') }]

  card.description = t('game.registry.description')

  if (variant === 'page') {
    return (
      <Card
        variant="page"
        card={card}
        entityType="registry"
        story={story}
        loading={false}
        onClose={onClose}
        //statItemsToPageContent={figures}
        bonusBadgeShowZeros
        hidePreview
      />
    )
  }

  return (
    <Card
      card={card}
      entityType="registry"
      onAction={onOpen}
      actionLabel={t('game.registry.open')}
      actionIcon="fa-scroll"
      statistics={figures}
      //flagShowFullStatistics
      //bonusBadgeListLittleIntoImage
      bonusBadgeShowZeros
    />
  )
}

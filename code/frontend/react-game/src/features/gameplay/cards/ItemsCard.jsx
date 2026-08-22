import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { buildItemsCard } from '@/utils/loadoutCards'

/**
 * ItemsCard — Step 34. The backpack card, in two shapes.
 *
 *   little (default)  the map card's twin in the statistics list: one footer action that
 *                     opens the bag.
 *   page              the LEFT reading page while the bag is open, exactly as MapPage owns
 *                     that page while the map is. Its back arrow closes the bag; the RIGHT
 *                     page meanwhile lists the items (ItemsCards).
 *
 * Both shapes carry the same description — how much is in the bag and how much still fits
 * — so the number the player reads before opening it is the number they keep seeing after.
 * That is also why ItemsCards has no header of its own: this card IS the header, and one
 * copy of a figure cannot disagree with itself.
 */
export default function ItemsCard({
  onOpen, onClose, variant = 'little', count = 0, weight, weightMax, story = null,
}) {
  const { t } = useTranslation()
  const card = buildItemsCard(t)
  // v0.35.2 — the figures are badges, not a sentence. They used to be written into the
  // description, where they read as prose and could not line up with the item rows on the
  // facing page; now they are the same BonusBadgeList an ItemCard carries, so the bag and
  // the things in it are measured in the same alphabet.
  const figures = [/*{ key: 'amount', value: `${count}`, label: t('game.items.count') }*/]
  if (weightMax) {
    figures.push({ key: 'weight', value: `${weight ?? 0}/${weightMax}`,
                   label: t('game.items.capacity') })
  }
  // What is left is the prose: what this page is for. The description is rendered through
  // SafeHtml and is only ever shown by the page variant — a little card shows its title
  // and image, never this.
  card.description = t('game.items.description')

  if (variant === 'page') {
    return (
      <Card
        variant="page"
        card={card}
        entityType="items"
        story={story}
        loading={false}
        onClose={onClose}
        statItemsToPageContent={figures}
        // An empty bag is exactly the state worth reporting: "0 items, 0/30" must not be
        // filtered away as a zero.
        bonusBadgeShowZeros
        hidePreview
      />
    )
  }

  return (
    <Card
      card={card}
      entityType="items"
      onAction={onOpen}
      actionLabel={t('game.items.open')}
      actionIcon="fa-suitcase"
      statistics={figures}
      flagShowFullStatistics
      bonusBadgeListLittleIntoImage
      bonusBadgeShowZeros
    />
  )
}

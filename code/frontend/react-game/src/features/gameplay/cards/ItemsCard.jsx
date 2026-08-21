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
  const carried = `${count} ${t('game.items.count')}`
  const figures = (weightMax
    ? `${carried} — ${t('game.items.capacity')} ${weight ?? 0}/${weightMax}`
    : carried)
  // The blank line separates the figures from the prose. The description is rendered
  // through SafeHtml (DOMPurify, html profile), which keeps <br> — and it is only ever
  // shown by the page variant: a little card renders its title and image, never this.
  card.description = `${figures}<br><br>${t('game.items.description')}`

  if (variant === 'page') {
    return (
      <Card
        variant="page"
        card={card}
        entityType="items"
        story={story}
        loading={false}
        onClose={onClose}
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
    />
  )
}

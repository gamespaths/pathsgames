import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { buildCardSad } from '@/utils/loadoutCards'

/**
 * Step 30 — SadnessCard tells the player their sadness reached its cap: they lost life
 * points equal to their constitution, their sadness reset to zero and they were forced
 * to sleep. Informational only, there is nothing to confirm — the backend already
 * applied it by the time this renders.
 *
 * Same dual mode as WeatherCard: with `onBack` it is a full book reading page shown on
 * the right; without it, a small board card that opens the big one via `onPreview`.
 *
 * `lifeLost` is the constitution the character paid, when the caller knows it.
 */
export default function SadnessCard({
  story,
  lifeLost = null,
  onPreview,
  onBack = null,
  previewSide = 'left',
}) {
  const { t } = useTranslation()

  const card = buildCardSad(t)
  const statItems = lifeLost
    ? [{ key: 'life', value: `-${lifeLost}`, label: t('game.stats.life') }]
    : []

  if (onBack) {
    return (
      <Card
        variant="page"
        card={card}
        entityType="sad"
        story={story}
        loading={false}
        onClose={onBack}
        statItemsToPageContent={statItems}
        hidePreview
      />
    )
  }

  return (
    <Card
      card={card}
      entityType="sad"
      story={story}
      flagInformationCard={true}
      onPreview={() => onPreview?.(card, 'sad', null, statItems, true, null, previewSide)}
    />
  )
}

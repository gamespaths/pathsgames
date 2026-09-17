import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { buildExperienceCard } from '@/utils/loadoutCards'
import { expStatRows } from '@/utils/experience'

/**
 * ExperienceCard — Step 38. The training card, in two shapes.
 *
 *   little (default)  last card of the board in a safe location, once the experience held
 *                     pays for at least one point: one footer action opens the training page.
 *   page              the LEFT reading page while training is open, exactly as ItemsCard owns
 *                     that page while the bag is. Its back arrow closes it; the RIGHT page
 *                     meanwhile lists one card per stat (ExperienceCards).
 *
 * Both shapes carry the same figures — the experience held and the price of the next point
 * per stat — so the number the player reads before opening it is the number they keep seeing.
 */
export default function ExperienceCard({
  onOpen, onClose, variant = 'little', story = null, experience = 0, expCosts = null,
}) {
  const { t } = useTranslation()
  const card = buildExperienceCard(t)
  const figures = [{ key: 'experience', value: `${experience ?? 0}`, label: t('game.stats.experience') }]
  // The price list, one figure per stat; a capped stat shows the word instead of a number.
  for (const row of expStatRows({ experience, expCosts, dexterity: 0, intelligence: 0, constitution: 0 })) {
    figures.push({ key: row.key, value: row.atCap ? t('game.exp.atMax') : `${row.cost}`,
                   label: t(`game.stats.${row.key}`) })
  }
  card.description = t('game.exp.description')

  if (variant === 'page') {
    return (
      <Card
        variant="page"
        card={card}
        entityType="experience"
        story={story}
        loading={false}
        onClose={onClose}
        statItemsToPageContent={figures}
        bonusBadgeShowZeros
        hidePreview
      />
    )
  }

  return (
    <Card
      card={card}
      entityType="experience"
      onAction={onOpen}
      actionLabel={t('game.exp.open')}
      actionIcon="fa-star"
      statistics={figures.slice(0, 1)}
      flagShowFullStatistics
      bonusBadgeListLittleIntoImage
      bonusBadgeShowZeros
    />
  )
}

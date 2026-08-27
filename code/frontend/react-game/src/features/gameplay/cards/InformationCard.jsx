import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import BonusBadgeList from '@/components/ui/BonusBadgeList'
import { buildStatBadges } from '@/utils/statBadges'

/**
 * v0.35.5 — InformationCard is the reading page behind the (i) lens of the game-status
 * card: the story title, the story artwork only when `showImage` (off while the weather
 * image is away), and one row per stat badge, each glossed by its own translated line.
 */
export default function InformationCard({
  card, story = null, playerStats = null, clock = null, entityType = 'information',
  showImage = false, ...rest
}) {
  const { t } = useTranslation()

  // Only the information page is dressed here; every other preview keeps the plain Card.
  if (entityType !== 'information') {
    return <Card card={card} story={story} entityType={entityType} {...rest} />
  }

  const stats = {
    ...(playerStats ?? {}),
    clock: clock?.currentClock,
    clockLabelSingular: clock?.clockLabelSingular,
  }
  const badges = buildStatBadges(stats, t, { plainFlag: true })

  // The artwork is the story's own, not the weather one the card was built from. Hidden,
  // it takes its credits with it: an "image by" under a page with no image credits nothing.
  const storyCard = story?.card ?? {}
  const image = showImage
    ? {
        urlImage: storyCard.urlImage ?? null,
        alternativeImage: storyCard.alternativeImage ?? null,
        copyrightText: storyCard.copyrightText ?? null,
        linkCopyright: storyCard.linkCopyright ?? null,
      }
    : { urlImage: null, alternativeImage: null, copyrightText: null, linkCopyright: null }

  const infoCard = {
    ...(card ?? {}),
    ...image,
    title: story?.title ?? card?.title,
    descriptionTag: true,
    description: (
      <div className="information-card-rows">
        {badges.map((badge, index) => (
          <div className="information-card-row" key={`${badge.key}-${index}`}>
            <BonusBadgeList items={[badge]} showZeros className="information-card-row-badge" />
            <span className="information-card-row-desc">{statDescription(t, badge.key)}</span>
          </div>
        ))}
      </div>
    ),
  }

  return <Card variant="page" card={infoCard} story={story} entityType={entityType} {...rest} />
}

/** The gloss under a stat badge; a stat with no translated line gets no text at all. */
function statDescription(t, key) {
  const translationKey = `game.stats.descriptions.${key}`
  const value = t(translationKey)
  return value === translationKey ? '' : value
}

import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { resolveSelectionEntity } from '@/utils/gamebook'
import { getNonZeroStats, STAT_CATEGORY_ORDER } from '@/utils/bonusStats'

/**
 * PlayerCards — the player's chosen loadout shown in the statistics view:
 * the selected class, character, traits, difficulty and the story card.
 *
 * Extracted from GameBook's `statisticsCards` branch. For the class, character,
 * trait and difficulty cards the entity stats are passed as Card's `statistics`
 * (with `flagShowFullStatistics`) so Card renders the BonusBadgeList overlaid on
 * the image itself.
 */
export default function PlayerCards({ storyFull, story, playerStats, gameData, onPreview }) {
  const { t } = useTranslation()

  // Build the {key, label, value} badge items for a resolved selection entity.
  const statItems = (entity, type) =>
    getNonZeroStats(entity, type, t).map(s => ({
      key: s.key,
      label: STAT_CATEGORY_ORDER.includes(s.key)
        ? t(`book.stats.totals.${s.key}`)
        : t(`book.stats.${s.key}`),
      value: '' + s.value,
    }))

  const classEntity      = resolveSelectionEntity(storyFull, playerStats, gameData, 'class')
  const characterEntity  = resolveSelectionEntity(storyFull, playerStats, gameData, 'character')
  const difficultyEntity = resolveSelectionEntity(storyFull, playerStats, gameData, 'difficulty')

  const classItems      = statItems(classEntity, 'class')
  const characterItems  = statItems(characterEntity, 'character')
  // The difficulty `energy` stat is the energy spent on every sleep — give it the
  // dedicated label rather than the generic stat one.
  const difficultyItems = statItems(difficultyEntity, 'difficulty')
  const difficultyItemsLong = difficultyItems.map(item => item.key === 'energy' ? { ...item, label: t('game.energyEverySleep') } : item)

  return (
    <>
      <Card card={classEntity?.card} entityType="class" story={storyFull} flagInformationCard={true}
        statistics={classItems} flagShowFullStatistics={true}
        onPreview={() => onPreview(classEntity?.card, 'class', null, classItems, true)}
      />
      <Card card={characterEntity?.card} entityType="character" story={storyFull} flagInformationCard={true}
        statistics={characterItems} flagShowFullStatistics={true}
        onPreview={() => onPreview(characterEntity?.card, 'character', null, characterItems, true)}
      />
      {playerStats?.traitUuids?.map((trait, index) => {
        const traitEntity = resolveSelectionEntity(storyFull, playerStats, gameData, 'trait', index)
        const traitItems = statItems(traitEntity, 'trait')
        return (
          <Card key={traitEntity?.uuid ?? trait?.uuid ?? index} card={traitEntity?.card} entityType="trait" story={storyFull} flagInformationCard={true}
            statistics={traitItems} flagShowFullStatistics={true}
            onPreview={() => onPreview(traitEntity?.card, 'trait', null, traitItems, true)}
          />
        )
      })}
      <Card card={difficultyEntity?.card} entityType="difficulty" story={storyFull} flagInformationCard={true}
        statistics={difficultyItems} flagShowFullStatistics={true}
        onPreview={() => onPreview(difficultyEntity?.card, 'difficulty', null, difficultyItemsLong, true)}
      />
      <Card card={story.card} entityType="story" story={story} flagInformationCard={true}
        onPreview={() => onPreview(story.card, 'story', null, null, true)}
      />
    </>
  )
}

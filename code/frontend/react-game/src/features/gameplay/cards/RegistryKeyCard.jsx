import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { registryValue } from '@/utils/registry'

/**
 * RegistryKeyCard — Step 36. One key of the registry, as a little card in the grid.
 *
 * The badges ride in the BODY, over the image, not in the title: `flagShowFullStatistics` is
 * exactly that switch on Card, and it is what the item cards beside it already do. The
 * category is one of those badges rather than a heading above a section, so the cards stay in
 * one grid.
 *
 * Its (i) opens the reading page on the RIGHT through the same `onPreview` door ItemCard uses,
 * so the detail needs no view state of its own.
 *
 * A key with no card still renders: the key name is the title, and the badge is the point.
 */
export default function RegistryKeyCard({ entry, story = null, onPreview, previewSide = 'right' }) {
  const { t } = useTranslation()
  const value = registryValue(entry)

  // showZeros is not optional here. BonusBadgeList drops anything whose value is not a
  // non-zero number, so a key worth 0 — or one holding a word — would be filtered out and the
  // card would show nothing at all.
  const badges = []
  if (entry?.category) {
    badges.push({ key: 'category', value: entry.category, label: null, icon: 'fas fa-folder' })
  }
  badges.push({ key: 'registry', value: `${value ?? '—'}`, label: null })

  const card = {
    ...(entry?.card ?? {}),
    title: entry?.card?.title || entry?.key,
  }

  function openPreview() {
    onPreview?.({
      card,
      type: 'registry',
      // On the reading page there IS room for labels, so the badges name themselves there.
      stats: [
        ...(entry?.category
          ? [{ key: 'category', value: entry.category, label: t('game.registry.category') }]
          : []),
        { key: 'registry', value: `${value ?? '—'}`, label: t('game.registry.value') },
      ],
      side: previewSide,
    })
  }

  return (
    <Card
      card={card}
      entityType="registry"
      story={story}
      statistics={badges}
      flagShowFullStatistics
      bonusBadgeListLittleIntoImage
      bonusBadgeShowZeros
      onPreview={openPreview}
    />
  )
}

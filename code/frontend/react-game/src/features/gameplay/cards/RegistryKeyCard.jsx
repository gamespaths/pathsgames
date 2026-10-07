import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { registryValue, registryValues } from '@/utils/registry'

/**
 * RegistryKeyCard — Step 36. One key of the registry, as a little card in the grid.
 *
 * The VALUE rides in the body, over the image — `flagShowFullStatistics` is exactly that
 * switch on Card, and it is what the item cards beside it already do. The CATEGORY rides in
 * the title instead, through `titleStatistics`: the drawer a key lives in belongs beside its
 * name, while what it holds belongs on the picture. Neither is a heading above a section, so
 * the cards stay in one grid.
 *
 * Its (i) opens the reading page on the RIGHT through the same `onPreview` door ItemCard uses,
 * so the detail needs no view state of its own.
 *
 * A key with no card still renders: the key name is the title, and the badges are the point.
 * A key holding NOTHING renders no value badge at all — an empty set is not worth a dash — and
 * a key holding SEVERAL renders one badge each, unless `joinValues` puts them back together.
 */
export default function RegistryKeyCard({ entry, story = null, onPreview, previewSide = 'right',
  joinValues = false }) {
  const { t } = useTranslation()
  const values = registryValues(entry)
  const value = registryValue(entry)

  // The category badge is PARKED, not gone: it goes back in the title when the grid is ready
  // to carry it again. Left here so putting it back is uncommenting, not rewriting.
  // const categoryBadges = entry?.category
  //   ? [{ key: 'category', value: entry.category, label: null, icon: 'fas fa-folder' }]
  //   : []

  // showZeros is not optional here. BonusBadgeList drops anything whose value is not a
  // non-zero number, so a key worth 0 — or one holding a word — would be filtered out and the
  // card would show nothing at all.
  // A key holding nothing gets no badge at all: an empty set is not a value worth a dash.
  // The scroll: the glyph this project already uses for the registry. Without it the badge
  // falls back to the grey dot of DEFAULT_VISUAL, since STAT_VISUAL has no registry entry.
  const badge = v => ({ key: 'registry', value: `${v}`, label: null,
    icon: 'fas fa-scroll', color: null })
  // One badge per member by default: a set of three clues reads as three things held, which
  // is what it is. `joinValues` puts them back under one badge for a key whose members only
  // mean anything together. Repeating the `registry` key is deliberate and supported —
  // BonusBadgeList keys its spans by position for exactly this.
  const badges = joinValues
    ? (value == null ? [] : [badge(value)])
    : values.map(badge)

  const card = {
    ...(entry?.card ?? {}),
    title: entry?.card?.title || entry?.key,
  }

  // The (i) opens a reading page whose whole point is the picture; without one the author
  // wrote no page worth turning to, so the button goes rather than opening an empty card.
  const hidePreview = !entry?.card?.urlImage

  function openPreview() {
    onPreview?.({
      card,
      type: 'registry',
      // On the reading page there IS room for labels, so the badges name themselves there.
      stats: [
        ...(entry?.category
          ? [{ key: 'category', value: entry.category, label: t('game.registry.category') }]
          : []),
        ...(value == null
          ? []
          : [{ key: 'registry', value: `${value}`, label: t('game.registry.value') }]),
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
      // titleStatistics={categoryBadges}
      flagShowFullStatistics
      bonusBadgeListLittleIntoImage
      bonusBadgeShowZeros
      hidePreview={hidePreview}
      additionalCardClasses="pg-card--registry"
      onPreview={openPreview}
    />
  )
}

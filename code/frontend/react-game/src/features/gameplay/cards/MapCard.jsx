import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { buildMapCard } from '@/utils/loadoutCards'

/**
 * MapCard — the little "world map" card shown in the statistics view
 * (before PlayerCards). The image comes from data/images.json (id "map",
 * via buildMapCard); the footer action button opens the map on the book's
 * left page through `onOpen`.
 */
export default function MapCard({ onOpen }) {
  const { t } = useTranslation()
  return (
    <Card
      card={buildMapCard(t)}
      entityType="map"
      onAction={onOpen}
      actionLabel={t('game.map.open')}
      actionIcon="fa-map"
    />
  )
}

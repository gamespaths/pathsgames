import { useTranslation } from '../../i18n/context'
import BonusBadgeList from '../../components/ui/BonusBadgeList'

const PLAYER_STAT_KEYS = [
  'life',
  'energy',
  'sadness',
  'experience',
  'food',
  'magic',
  'coins',
  'weight',
]

export default function PlayerStats({ stats }) {
  const { t } = useTranslation()

  const items = PLAYER_STAT_KEYS.map(key => ({
    key,
    label: t(`game.stats.${key}`),
    value: stats?.[key] ?? 0,
  }))

  return <BonusBadgeList items={items} showZeros />
}

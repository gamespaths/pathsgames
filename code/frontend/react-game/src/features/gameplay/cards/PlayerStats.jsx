import { useTranslation } from '../../../i18n/context'
import BonusBadgeList from '../../../components/ui/BonusBadgeList'
import { buildStatBadges } from '../../../utils/statBadges'

export default function PlayerStats({ stats , className 
    , plainFlag=false , showZeros=true , specificKeys=null , showLabel=true , showItems=true }) {

  const { t } = useTranslation()

  const badges = buildStatBadges(stats, t, { plainFlag, showLabel, specificKeys })

  // Step 34 — the backpack has a page of its own now, so the compact card that only has
  // room for the gauges opts out with showItems={false} instead of listing them twice.
  const items = showItems && Array.isArray(stats?.items) ? stats.items : []

  return (
    <>
      <BonusBadgeList className={className} items={badges} showZeros={showZeros} />
      {items.length > 0 && (
        <div className={`player-items-list `} aria-label={t('game.stats.items')}>
          {items.map(it => (
            <span key={it.uuid} className="stat-badge bonus-badge" title={it.name || it.itemUuid}>
              <i className="fas fa-box" style={{ color: '#95a5a6' }} />
              <span>{it.name || it.itemUuid}</span>
              <strong>×{it.amount ?? 1}</strong>
            </span>
          ))}
        </div>
      )}
    </>
  )
}

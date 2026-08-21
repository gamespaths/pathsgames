import { useTranslation } from '../../../i18n/context'
import BonusBadgeList from '../../../components/ui/BonusBadgeList'

// Stats shown as a current/max gauge (Step 27) paired with their max key.
const GAUGE_KEYS = [
  ['life', 'lifeMax'],
  ['energy', 'energyMax'],
  ['sadness', 'sadnessMax'],
  ['weight', 'weightMax'],
]

// Plain single-value stats (no max projected by /info yet).
const PLAIN_KEYS = ['experience', 'food', 'magic', 'coins' , 'dexterity', 'intelligence', 'constitution']

export default function PlayerStats({ stats , className 
    , plainFlag=false , showZeros=true , specificKeys=null , showLabel=true , showItems=true}) {

  const { t } = useTranslation()

  const keysList = specificKeys ?? GAUGE_KEYS; 
  const gauge = keysList.map(([key, maxKey]) => {
    const value = stats?.[key] ?? 0
    const max = stats?.[maxKey] ?? 0
    return {
      key,
      label: showLabel ? t(`game.stats.${key}`) : null,
      // current/max when a max is known, otherwise the bare current value
      value: max ? `${value}/${max}` : value,
    }
  })

  const plain = PLAIN_KEYS.map(key => ({
    key,
    label: t(`game.stats.${key}`),
    value: stats?.[key] ?? 0,
  }))

  // Step 34 — the backpack has a page of its own now, so the compact card that only has
  // room for the gauges opts out with showItems={false} instead of listing them twice.
  const items = showItems && Array.isArray(stats?.items) ? stats.items : []

  let clockStat=[]
  if (plainFlag && stats.clock!=null){ 
    clockStat.push({ key: 'clock', label: stats.clockLabelSingular ?? "Time", value: stats.clock }) }

  return (
    <>
      <BonusBadgeList className={className} items={[...clockStat,  ...gauge  , ...(plainFlag ? plain : []) ] } showZeros={showZeros} />
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

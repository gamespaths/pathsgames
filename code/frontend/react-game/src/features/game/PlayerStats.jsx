import { useTranslation } from '../../i18n/context'

const STATS = [
  { key: 'life',       icon: 'fas fa-heart',        color: '#e74c3c' },
  { key: 'energy',     icon: 'fas fa-bolt',          color: '#f39c12' },
  { key: 'sadness',    icon: 'fas fa-cloud-rain',    color: '#6c8ebf' },
  { key: 'experience', icon: 'fas fa-star',           color: '#9b59b6' },
  { key: 'food',       icon: 'fas fa-drumstick-bite', color: '#27ae60' },
  { key: 'magic',      icon: 'fas fa-magic',          color: '#1abc9c' },
  { key: 'coins',      icon: 'fas fa-coins',          color: '#f1c40f' },
  { key: 'weight',     icon: 'fas fa-weight-hanging', color: '#95a5a6' },
]

export default function PlayerStats({ stats }) {
  const { t } = useTranslation()

  return (
    <div className="player-stats-bar">
      {STATS.map(({ key, icon, color }) => (
        <span key={key} className="stat-badge">
          <i className={icon} style={{ color }} />
          {t(`game.stats.${key}`)}: <strong>{stats?.[key] ?? 0}</strong>
        </span>
      ))}
    </div>
  )
}

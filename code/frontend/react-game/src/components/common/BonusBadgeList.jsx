/**
 * BonusBadgeList — renders a flex-wrap row of bonus pill badges.
 * Shared between BookPageContent (entity stats) and ConfigView (total bonus).
 *
 * @param {Array} items - [{ key, label, value }]
 * @param {string} className - optional extra class on the wrapper
 */
export default function BonusBadgeList({ items, className = '' }) {
  if (!items || items.length === 0) return null

  return (
    <div className={['bonus-badge-list', className].filter(Boolean).join(' ')}>
      {items.map(item => (
        <span key={item.key} className="badge bonus-badge">
          <span className="bonus-badge__label">{item.label}</span>
          <span className="bonus-badge__value">{item.value}</span>
        </span>
      ))}
    </div>
  )
}

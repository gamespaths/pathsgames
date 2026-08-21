/**
 * BonusBadgeList — renders a row of stat badges using the player-stats-bar +
 * stat-badge classes, with a coloured Font-Awesome icon for each stat.
 *
 * Shared between BookPageContent (entity stats), ConfigView (total bonuses)
 * and the in-game PlayerStats bar (live match stats).
 *
 * By default items with a zero or missing value are hidden — pass `showZeros`
 * to render every item regardless of value (used by live PlayerStats so that
 * a player can see when a stat drops to 0).
 *
 * @param {Array}   items      - [{ key, label, value, prefix }]; `prefix` is written
 *                               straight before the value (e.g. 'x' for a carried
 *                               amount) and, unlike the value itself, is never parsed —
 *                               so the zero-filter below keeps working on a number.
 * @param {string}  className  - optional extra class on the wrapper
 * @param {boolean} showZeros  - keep items with value 0/missing (default false)
 */

const STAT_VISUAL = {
  // Canonical categories (totals + class bonuses)
  life:         { icon: 'fas fa-heart',         color: '#e74c3c' },
  energy:       { icon: 'fas fa-bolt',          color: '#f39c12' },
  sad:          { icon: 'fas fa-frown',    color: '#dee694' },
  dexterity:    { icon: 'fas fa-running',       color: '#3498db' },
  intelligence: { icon: 'fas fa-brain',         color: '#9b59b6' },
  constitution: { icon: 'fas fa-shield-alt',    color: '#8e44ad' },
  weight:       { icon: 'fas fa-weight-hanging',color: '#95a5a6' },
  exp:          { icon: 'fas fa-star',          color: '#9b59b6' },

  // Step 34 — a carried amount needs no glyph: the x in front of the number already
  // says "how many", and an icon next to it would only repeat it. `icon: null` is what
  // opts out; every other key keeps falling back to DEFAULT_VISUAL.
  amount:       { icon: null,                   color: null },

  // Step 26 — location time counter (clock_counter) shown as a statistic
  clockCounter: { icon: 'fas fa-hourglass-half', color: '#d4af37' },
  clock:        { icon: 'fas fa-hourglass-half', color: '#d4af37' },

  // Live player stats (in-match) — see PlayerStats.jsx
  sadness:      { icon: 'fas fa-frown',    color: '#dee694' },
  experience:   { icon: 'fas fa-star',           color: '#9b59b6' },
  food:         { icon: 'fas fa-drumstick-bite', color: '#27ae60' },
  magic:        { icon: 'fas fa-magic',          color: '#1abc9c' },
  coins:        { icon: 'fas fa-coins',          color: '#f1c40f' },

  // Character base stats
  lifeMax:           { icon: 'fas fa-heart',         color: '#e74c3c' },
  energyMax:         { icon: 'fas fa-bolt',          color: '#f39c12' },
  sadMax:            { icon: 'fas fa-frown',      color: '#dee694' },
  dexterityStart:    { icon: 'fas fa-running',       color: '#3498db' },
  intelligenceStart: { icon: 'fas fa-brain',         color: '#9b59b6' },
  constitutionStart: { icon: 'fas fa-shield-alt',    color: '#8e44ad' },

  // Class base stats
  weightMax:         { icon: 'fas fa-weight-hanging',color: '#95a5a6' },
  dexterityBase:     { icon: 'fas fa-running',       color: '#3498db' },
  intelligenceBase:  { icon: 'fas fa-brain',         color: '#9b59b6' },
  constitutionBase:  { icon: 'fas fa-shield-alt',    color: '#8e44ad' },

  // Trait / difficulty stats
  costPositive:           { icon: 'fas fa-plus-circle',  color: '#27ae60' },
  costNegative:           { icon: 'fas fa-minus-circle', color: '#c0392b' },
  expCost:                { icon: 'fas fa-star',         color: '#9b59b6' },
  maxWeight:              { icon: 'fas fa-weight-hanging',color: '#95a5a6' },
  minCharacter:           { icon: 'fas fa-users',        color: '#34495e' },
  maxCharacter:           { icon: 'fas fa-users',        color: '#34495e' },
  costHelpComa:           { icon: 'fas fa-hand-holding-medical', color: '#16a085' },
  costMaxCharacteristics: { icon: 'fas fa-arrow-up',     color: '#2980b9' },
  numberMaxFreeAction:    { icon: 'fas fa-running',      color: '#3498db' },
}

const DEFAULT_VISUAL = { icon: 'fas fa-circle', color: '#7f8c8d' }


export default function BonusBadgeList({ items, className = '', showZeros = false , lockedReason=null , littleVersion=false }) {
  //console.log("BonusBadgeList", items, className, showZeros , lockedReason , littleVersion);
  if (!items || items.length === 0) return null
  
  const visibleItems = showZeros
    ? items
    : items.filter(item => {
        try{
          if (item?.value.includes("/")){
            const parts=item.value.split("/")
            const v1 = Number(parts[0])
            const v2 = Number(parts[1])
            return (Number.isFinite(v1) && v1 !== 0) && (Number.isFinite(v2) && v2 !== 0)
          }
        } catch (e) { // Ignore errors and treat as zero
          //console.warn("BonusBadgeList: error parsing value", item?.value, e);
        }
        const v = Number(item?.value)
        return Number.isFinite(v) && v !== 0
      })
  if (visibleItems.length === 0) return null

  return (
    <div className={['player-stats-bar', 'bonus-badge-list', className].filter(Boolean).join(' ')}>
      {lockedReason && (
        <span className="stat-badge bonus-badge locked" title={lockedReason} aria-label={lockedReason}>
          <i className="fas fa-lock" /> {lockedReason}
        </span>
      )}
      {visibleItems.map(item => {
        const visual = STAT_VISUAL[item.key] ?? DEFAULT_VISUAL
        return (
          <span key={item.key} className={ "stat-badge bonus-badge" + (littleVersion ? " bonus-badge-little-version" : "") } title={item.label} aria-label={item.label}>
            {visual.icon && <i className={visual.icon} style={{ color: visual.color }} />}
            {!littleVersion && <span>{item.label}{item.label ? ':' : ''}</span>} 
            <strong>{item.prefix ?? ''}{item.value}</strong>
          </span>
        )
      })}
    </div>
  )
}

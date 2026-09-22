import { useTranslation } from '../../i18n/context'
import Card from '../../components/layout/Card'
import BonusBadgeList from '../../components/ui/BonusBadgeList'
import { buildClassesById, getNonZeroStats, getOptionLockInfo } from '../../utils/bonusStats'
import { canAddTrait, isTraitSelected, traitBudgetItems, traitCostItems } from '../../utils/traitBudget'

export default function OptionPicker({ type, options, selected, story, config, onSelect, onBack, onPreview }) {
  const { t } = useTranslation()

  const classesById = buildClassesById(story?.classes)

  // Step 23 — traits are multi-select within the difficulty cost budgets.
  const isTraitPicker = type === 'trait'
  const selectedTraits = isTraitPicker ? (Array.isArray(selected) ? selected : []) : null
  // Cost used/max of the selection, badged beside the title (null budget → used only).
  const budgetItems = isTraitPicker ? traitBudgetItems(config?.difficulty, selectedTraits, t) : null

  function lockMessage(lock) {
    if (!lock) return null
    if (lock.kind === 'budget') return t('book.traitBudgetExceeded')
    const className = lock.className ?? (lock.classId != null ? `#${lock.classId}` : '?')
    if (lock.kind === 'requires') return t('book.notAllowedRequires').replace('{class}', className)
    if (lock.kind === 'prohibited') return t('book.notAllowedProhibited').replace('{class}', className)
    return t('book.notAllowedGeneric')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="selection-header ">
        {/* v0.38.3 — the title and the back arrow live on the LEFT page card now; only the
            trait budget stays here, over the list it counts.
        <h3 className="selection-title">
          <button className=" float-left" onClick={onBack}>
            <i className="fas fa-arrow-left me-1" />{ /*t('book.back')* / }
          </button>
          {t('book.selectTitle')} {t(`book.${type}`)}
        </h3>
        */}
        {isTraitPicker && (
          <span className="trait-budget-info" data-testid="trait-budget">
            <BonusBadgeList items={budgetItems} littleVersion={true} />
          </span>
        )}
      </div>

      <div className="selection-scroll">
        <div className="selection-list">
          {options.map((opt, i) => {
            let lockInfo = getOptionLockInfo({ type, option: opt, config, classesById  })
            const optSelected = isTraitPicker
              ? isTraitSelected(opt, selectedTraits)
              : (selected?.uuid === opt.uuid && selected?.uuid)
            // Step 23 — a not-yet-selected trait that would exceed the budget
            // is locked; selected traits stay clickable so they can be removed.
            if (isTraitPicker && !lockInfo && !optSelected
                && !canAddTrait(opt, selectedTraits, config?.difficulty)) {
              lockInfo = { kind: 'budget', label: t('book.traitCostLock') }
            }
            const isLocked = !!lockInfo
            const lockedReason = lockMessage(lockInfo)
            // Trait: its cost (zero included, budgeted sides only) leads the stats, on the
            // card title and on the page card alike.
            const costItems = isTraitPicker ? traitCostItems(opt, t, config?.difficulty) : []
            const statItemsToPageContent = costItems.concat(getNonZeroStats(opt, type, t))
            //console.log("option",opt ,"getNonZeroStats", getNonZeroStats(opt, type, t)  );
            //console.log("option",opt ,"getNonZeroStats", statItemsToPageContent  );
            const previewHandler = onPreview ? () => 
              onPreview(opt, type , lockedReason , statItemsToPageContent) : undefined

            
            return (
            <Card story={story}
              key={opt.uuid ?? opt.name ?? i}
              variant="little"
              card={opt.card}
              label={t(`book.${type}`)}
              imageAlt={opt.name}
              icon={opt.icon}
              name={opt.card?.title ?? opt.card?.name ?? opt.name}
              description={opt.card?.description ?? opt.description}
              selected={optSelected}
              locked={isLocked}
              lockedReason={lockedReason} lockInfo={lockInfo}
              onSelect={isLocked ? undefined : () => onSelect(opt)}
              onPreview={previewHandler}
              selectLabel={isTraitPicker && optSelected ? t('book.remove') : t('book.select')}
              statistics={statItemsToPageContent}
            />
          )})}
        </div>
      </div>
    </div>
  )
}

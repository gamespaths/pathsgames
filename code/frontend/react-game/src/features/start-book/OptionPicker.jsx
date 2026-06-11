import { useTranslation } from '../../i18n/context'
import GameCard from '../../components/layout/GameCard'
import { buildClassesById, getOptionLockInfo } from '../../utils/bonusStats'
import { canAddTrait, isTraitSelected, remainingTraitBudget } from '../../utils/traitBudget'

export default function OptionPicker({ type, options, selected, story, config, onSelect, onBack, onPreview }) {
  const { t } = useTranslation()

  const classesById = buildClassesById(story?.classes)

  // Step 23 — traits are multi-select within the difficulty cost budgets.
  const isTraitPicker = type === 'trait'
  const selectedTraits = isTraitPicker ? (Array.isArray(selected) ? selected : []) : null
  const budget = isTraitPicker ? remainingTraitBudget(config?.difficulty, selectedTraits) : null

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
        <h3 className="selection-title">
          <button className=" float-left" onClick={onBack}>
            <i className="fas fa-arrow-left me-1" />{ /*t('book.back')*/ }
          </button>
          {t('book.selectTitle')} {t(`book.${type}`)}
        </h3>
        {isTraitPicker && (budget.positive !== null || budget.negative !== null) && (
          <p className="trait-budget-info" data-testid="trait-budget">
            {budget.positive !== null && (
              <span className="me-2">{t('book.traitBudgetPositive')}: {budget.positive}</span>
            )}
            {budget.negative !== null && (
              <span>{t('book.traitBudgetNegative')}: {budget.negative}</span>
            )}
          </p>
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
              lockInfo = { kind: 'budget' }
            }
            const isLocked = !!lockInfo
            const lockedReason = lockMessage(lockInfo)
            const previewHandler = onPreview ? () => onPreview(opt, type , lockedReason) : undefined
            return (
            <GameCard story={story}
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
            />
          )})}
        </div>
      </div>
    </div>
  )
}

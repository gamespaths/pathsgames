import { useTranslation } from '../../i18n/context'
import GameCard from '../../components/layout/GameCard'
import { buildClassesById, getOptionLockInfo } from '../../utils/bonusStats'

export default function SelectionView({ type, options, selected, story, config, onSelect, onBack, onPreview }) {
  const { t } = useTranslation()

  const classesById = buildClassesById(story?.classes)

  function lockMessage(lock) {
    if (!lock) return null
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
      </div>

      <div className="selection-scroll">
        <div className="selection-list">
          {options.map((opt, i) => {
            const previewHandler = onPreview ? () => onPreview(opt, type) : undefined
            const lockInfo = getOptionLockInfo({ type, option: opt, config, classesById  })
            const isLocked = !!lockInfo
            const reason = lockMessage(lockInfo)
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
              selected={selected?.uuid === opt.uuid && selected?.uuid}
              locked={isLocked}
              lockedReason={reason} lockInfo={lockInfo} 
              onSelect={isLocked ? undefined : () => onSelect(opt)}
              onPreview={previewHandler}
              selectLabel={t('book.select')}
            />
          )})}
        </div>
      </div>
    </div>
  )
}

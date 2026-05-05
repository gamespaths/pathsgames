import { useTranslation } from '../../i18n/context'
import ConfigCard from './ConfigCard'

export default function SelectionView({ type, options, selected, story, onSelect, onBack }) {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="selection-header">
        <button className="btn-back" onClick={onBack}>
          <i className="fas fa-arrow-left me-1" />{t('book.back')}
        </button>
        <h3 className="selection-title">
          {t('book.selectTitle')} {t(`book.${type}`)}
        </h3>
      </div>

      <div className="selection-scroll">
        <div className="selection-list">
          {options.map((opt, i) => (
            <ConfigCard
              key={opt.uuid ?? opt.name ?? i}
              type={type}
              value={opt}
              selected={selected?.name === opt.name}
              story={story}
              onSelect={() => onSelect(opt)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

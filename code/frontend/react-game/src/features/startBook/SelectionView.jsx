import { useTranslation } from '../../i18n/context'
import GameCard from '../../components/layout/GameCard'

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
        <div className="card-big-list">
          {options.map((opt, i) => (
            <GameCard story={story}
              key={opt.uuid ?? opt.name ?? i}
              variant="big"
              card={opt.card}
              label={t(`book.${type}`)}
              imageAlt={opt.name}
              icon={opt.icon}
              name={opt.card?.title ?? opt.card?.name ?? opt.name}
              description={opt.card?.description ?? opt.description}
              selected={selected?.name === opt.name}
              onSelect={() => onSelect(opt)}
              selectLabel={t('book.select')}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

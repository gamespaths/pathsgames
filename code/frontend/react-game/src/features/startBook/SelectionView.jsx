import { useTranslation } from '../../i18n/context'
import GameCard from '../../components/layout/GameCard'

export default function SelectionView({ type, options, selected, story, onSelect, onBack , onPreview }) {
  const { t } = useTranslation()
console.log('SelectionView', { type, options, selected })
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
              onSelect={() => onSelect(opt)}
              onPreview={previewHandler}
              selectLabel={t('book.select')}
            />
          )})}
        </div>
      </div>
    </div>
  )
}

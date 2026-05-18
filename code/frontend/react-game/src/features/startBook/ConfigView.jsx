import { useTranslation } from '../../i18n/context'
import ConfigCard from './ConfigCard'
import BonusBadgeList from '../../components/common/BonusBadgeList'
import images from '../../mock/images.json'
import { aggregateBonusTotals } from '../../utils/bonusStats'

const imgById = id => images.find(x => x.id === id)

export default function ConfigView({ config, story, onChangeClick, onPreview, termsAccepted, onTermsChange, onStartGame }) {
  const { t } = useTranslation()

  const totals = aggregateBonusTotals([
    { entity: config.character,  type: 'character' },
    { entity: config.class,      type: 'class' },
    { entity: config.trait,      type: 'trait' },
    { entity: config.difficulty, type: 'difficulty' },
  ])
  const totalItems = totals.map(({ category, value }) => ({
    key: category,
    label: t(`book.stats.totals.${category}`),
    value,
  }))

  const personImg  = imgById('person')
  const gemsImg    = imgById('gems')

  const gameTypeValue = {
    name: t('book.single'),
    icon: 'fas fa-user',
    card: { urlImage: personImg?.urlImage, copyrightText: 'Single Player', linkCopyright: personImg?.linkCopyright },
  }
  const loginValue = {
    name: t('book.guest'),
    icon: 'fas fa-user-circle',
    card: { urlImage: gemsImg?.urlImage, copyrightText: 'Guest', linkCopyright: gemsImg?.linkCopyright },
  }

  return (
    <div className="config-view-wrap">

      <div className="config-cards-area selection-list">
        {/* Selectable cards: BOTH "Cambia" and the magnifying glass open the
            selection list + preview together (handled by onChangeClick). */}
        <ConfigCard type="class"      value={config.class}      story={story} onChangeClick={() => onChangeClick('class')}      onPreview={() => onChangeClick('class')} />
        <ConfigCard type="character"  value={config.character}  story={story} onChangeClick={() => onChangeClick('character')}  onPreview={() => onChangeClick('character')} />          
        <ConfigCard type="trait"      value={config.trait}      story={story} onChangeClick={() => onChangeClick('trait')}      onPreview={() => onChangeClick('trait')} />
        <ConfigCard type="difficulty" value={config.difficulty} story={story} onChangeClick={() => onChangeClick('difficulty')} onPreview={() => onChangeClick('difficulty')} />
        {/* Locked cards: lens is preview-only (no selection list to open). */}
        <ConfigCard type="gameType"   value={gameTypeValue} locked onPreview={onPreview} />
        <ConfigCard type="login"      value={loginValue}    locked onPreview={onPreview} />
      </div>
      {totalItems.length > 0 && (
        <BonusBadgeList className="config-total-bonus" items={totalItems} />
      )}
      <div className="page-footer">
        <label className="terms-label" aria-label={t('book.acceptTerms')}>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => onTermsChange(e.target.checked)}
          />
          <button
            type="button"
            className="terms-link-btn"
            data-bs-toggle="modal"
            data-bs-target="#termsModal"
            onClick={e => e.stopPropagation()}
          >
            {t('book.acceptTerms')}
          </button>
        </label>
        <button
          className="btn-start-game"
          disabled={!termsAccepted}
          onClick={onStartGame}
        >
          <i className="fas fa-play me-2" />{t('book.startGame')}
        </button>
      </div>


    </div>
  )
}

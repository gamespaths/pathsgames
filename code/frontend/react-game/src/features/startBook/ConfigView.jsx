import { useTranslation } from '../../i18n/context'
import ConfigCard from './ConfigCard'
import images from '../../mock/images.json'

const imgById = id => images.find(x => x.id === id)

export default function ConfigView({ config, story, onChangeClick, termsAccepted, onTermsChange, onStartGame }) {
  const { t } = useTranslation()

  const personImg  = imgById('person')
  const gemsImg    = imgById('gems')

  const gameTypeValue = {
    name: t('book.single'),
    icon: 'fas fa-user',
    card: { imageUrl: personImg?.imageUrl, copyrightText: 'Single Player', linkCopyright: personImg?.linkCopyright },
  }
  const loginValue = {
    name: t('book.guest'),
    icon: 'fas fa-user-circle',
    card: { imageUrl: gemsImg?.imageUrl, copyrightText: 'Guest', linkCopyright: gemsImg?.linkCopyright },
  }

  return (
    <div className="config-view-wrap">
      <h3 className="config-title">
        <i className="fas fa-scroll me-2" />{t('book.configureAdventure')}
      </h3>

      <div className="config-cards-area mt-2">
        <div className="selection-list">
          <ConfigCard type="character"  value={config.character}  story={story} onChangeClick={() => onChangeClick('character')} />
          <ConfigCard type="class"      value={config.class}      story={story} onChangeClick={() => onChangeClick('class')} />
          <ConfigCard type="trait"      value={config.trait}      story={story} onChangeClick={() => onChangeClick('trait')} />
          <ConfigCard type="difficulty" value={config.difficulty} story={story} onChangeClick={() => onChangeClick('difficulty')} />
          <ConfigCard type="gameType"   value={gameTypeValue} locked />
          <ConfigCard type="login"      value={loginValue}    locked />
        </div>
      </div>

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

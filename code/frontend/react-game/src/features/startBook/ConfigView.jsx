import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import ConfigCard from './ConfigCard'
import BonusBadgeList from '../../components/common/BonusBadgeList'
import TurnstileWidget from '../../components/common/TurnstileWidget'
import AntibotMessage from '../../components/common/AntibotMessage'
import { aggregateBonusTotals } from '../../utils/bonusStats'
import { buildGameTypeCard, buildLoginCard } from './loadoutCards'
import { CF_KEY, TURNSTILE_APPEARANCE } from '../../utils/turnstile'

export default function ConfigView({ config, story, onChangeClick, onPreview, termsAccepted, onTermsChange, onStartGame }) {
  const { t } = useTranslation()
  // Antibot runs only after the player commits: 'idle' shows terms + button,
  // 'checking' hides them and runs Turnstile, 'bot' shows the funny message.
  const [phase, setPhase] = useState('idle')

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

  const gameTypeValue = buildGameTypeCard(t)
  const loginValue    = buildLoginCard(t)

  // "Start Game" click: with no site key, start immediately (dev bypass);
  // otherwise hide the controls and begin the Turnstile check.
  function handleStartClick() {
    if (!termsAccepted) return
    if (!CF_KEY) { onStartGame(null); return }
    setPhase('checking')
  }

  return (
    <div className="config-view-wrap">

      <div className="config-cards-area selection-list">
        {/* Selectable cards: BOTH "Cambia" and the magnifying glass open the
            selection list + preview together (handled by onChangeClick). */}
        <ConfigCard type="class"      value={config.class}      story={story} onChangeClick={() => onChangeClick('class')}      onPreview={() => onChangeClick('class')}      count={story?.classes?.length}            onPagePreview={onPreview} />
        <ConfigCard type="character"  value={config.character}  story={story} onChangeClick={() => onChangeClick('character')}  onPreview={() => onChangeClick('character')}  count={story?.characterTemplates?.length} onPagePreview={onPreview} />
        <ConfigCard type="trait"      value={config.trait}      story={story} onChangeClick={() => onChangeClick('trait')}      onPreview={() => onChangeClick('trait')}      count={story?.traits?.length}             onPagePreview={onPreview} />
        <ConfigCard type="difficulty" value={config.difficulty} story={story} onChangeClick={() => onChangeClick('difficulty')} onPreview={() => onChangeClick('difficulty')} count={story?.difficulties?.length}       onPagePreview={onPreview} />
        {/* Locked cards: lens is preview-only (no selection list to open). */}
        <ConfigCard type="gameType"   value={gameTypeValue} locked onPreview={onPreview} />
        <ConfigCard type="login"      value={loginValue}    locked onPreview={onPreview} />
      </div>
      {totalItems.length > 0 && (
        <BonusBadgeList className="config-total-bonus" items={totalItems} />
      )}
      <div className="page-footer">
        {phase === 'bot' ? (
          <AntibotMessage />
        ) : phase === 'checking' ? (
          <div className="turnstile-checking">
            <p><i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}</p>
            <TurnstileWidget
              appearance={TURNSTILE_APPEARANCE.config}
              onSuccess={token => onStartGame(token)}
              onError={() => setPhase('bot')}
              onExpire={() => setPhase('bot')}
            />
          </div>
        ) : (
          <>
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
              onClick={handleStartClick}
            >
              <i className="fas fa-play me-2" />{t('book.startGame')}
            </button>
          </>
        )}
      </div>


    </div>
  )
}

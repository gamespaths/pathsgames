import { useState, useEffect } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { useTranslation } from '../../i18n/context'
import ConfigCard from './ConfigCard'
import BonusBadgeList from '../../components/common/BonusBadgeList'
import { aggregateBonusTotals } from '../../utils/bonusStats'
import { buildGameTypeCard, buildLoginCard } from './loadoutCards'

const CF_KEY = import.meta.env.VITE_CF_TURNSTILE_KEY
const _RAW_DELAY = Number(import.meta.env.VITE_TURNSTILE_DELAY_BEFORE_START)
const TURNSTILE_DELAY_MS = Number.isFinite(_RAW_DELAY) && _RAW_DELAY > 0 ? _RAW_DELAY * 1000 : 20000

export default function ConfigView({ config, story, onChangeClick, onPreview, termsAccepted, onTermsChange, onStartGame }) {
  const { t } = useTranslation()
  const [cfToken, setCfToken] = useState(null)
  const [turnstileVisible, setTurnstileVisible] = useState(false)

  useEffect(() => {
    if (!CF_KEY) return
    const id = setTimeout(() => setTurnstileVisible(true), TURNSTILE_DELAY_MS)
    return () => clearTimeout(id)
  }, [])

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
        {(!CF_KEY || cfToken) && ( <label className="terms-label" aria-label={t('book.acceptTerms')}>
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
        </label>)}
        {CF_KEY && turnstileVisible && (
          <div style={cfToken ? { visibility: 'hidden', height: 0, overflow: 'hidden', width: 0 } : null } >
            <Turnstile
              siteKey={CF_KEY}
              onSuccess={setCfToken}
              onExpire={() => setCfToken(null)}
              onError={() => setCfToken(null)}
              options={{ theme: 'dark', size: 'flexible' }}
            />
          </div>
        )}
        {(!CF_KEY || cfToken) && (
          <button
            className="btn-start-game"
            disabled={!termsAccepted}
            onClick={() => onStartGame(cfToken)}
          >
            <i className="fas fa-play me-2" />{t('book.startGame')}
          </button>
        )}
      </div>


    </div>
  )
}

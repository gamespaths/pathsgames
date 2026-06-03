import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import ConfigCard from './ConfigCard'
import BonusBadgeList from '../../components/common/BonusBadgeList'
import TurnstileWidget from '../../components/common/TurnstileWidget'
import { aggregateBonusTotals } from '../../utils/bonusStats'
import {
  buildGameTypeCard,
  buildLoginCard,
  buildTermsCard,
  buildAntibotCard,
  buildFreeToPlay,
} from './loadoutCards'
import { CF_KEY, TURNSTILE_APPEARANCE } from '../../utils/turnstile'

/**
 * StartGameView — confirmation step shown after "Start Game" in ConfigView.
 *
 * Same grid graphics as ConfigView (six cards + a footer). The first row
 * (terms, game type, login) is always visible; the second row (antibot OK,
 * free to play, story) stays hidden while the antibot check runs and is
 * revealed once Turnstile succeeds. The footer drives the phase machine:
 *   'checking' → runs Turnstile (or auto-passes when no site key is set),
 *   'ready'    → terms toggle + Start button that creates the match,
 *   'bot'      → funny antibot message.
 */
export default function StartGameView({ story, config, termsAccepted, onTermsChange, onPreview, onStartGame, onBack }) {
  const { t } = useTranslation()
  // With no site key (dev bypass) the antibot check passes immediately.
  // 'checking' → Turnstile running, 'ready' → passed, 'error' → failed (offers
  // a retry instead of permanently blocking — mobile networks/webviews trip the
  // widget often and that is not a bot).
  const [phase, setPhase] = useState(CF_KEY ? 'checking' : 'ready')
  const [token, setToken] = useState(null)
  const [attempt, setAttempt] = useState(0)

  // Re-mount the widget (fresh challenge) and go back to verifying.
  function retryAntibot() {
    setAttempt(a => a + 1)
    setPhase('checking')
  }

  const termsValue    = buildTermsCard(t)
  const gameTypeValue = buildGameTypeCard(t)
  const loginValue    = buildLoginCard(t)
  const antibotValue  = buildAntibotCard(t)
  const freeValue     = buildFreeToPlay(t)
  const storyValue    = { name: story?.title ?? story?.name, card: story?.card, description: story?.description }

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

  const ready = phase === 'ready'

  // The terms card's magnifying glass opens the shared Terms & Conditions modal.
  function openTermsModal() {
    const el = document.getElementById('termsModal')
    const Modal = window.bootstrap?.Modal
    if (el && Modal) Modal.getOrCreateInstance(el).show()
  }

  function handleStart() {
    if (!termsAccepted || !ready) return
    onStartGame(token)
  }

  return (
    <div className="config-view-wrap">

      <div className="config-cards-area selection-list">
        {/* First row — always visible. */}
        <ConfigCard
          type="terms"
          value={termsValue}
          selected={termsAccepted}
          onSelect={() => onTermsChange(!termsAccepted)}
          onPreview={openTermsModal}
          selectLabel={termsAccepted ? t('book.accepted') : t('book.accept')}
        />
        <ConfigCard type="gameType" value={gameTypeValue} locked onPreview={onPreview} />
        <ConfigCard type="login"    value={loginValue}    locked onPreview={onPreview} />

        {/* Second row — revealed only after the antibot check passes. */}
        {ready && <ConfigCard type="antibot"    value={antibotValue} onPreview={onPreview}  locked={true} lockedIcon="fas fa-check-circle"/>}
        {ready && <ConfigCard type="freeToPlay" value={freeValue}    onPreview={onPreview}  locked={true} lockedIcon="fas fa-check-circle" lockInfo="free"/> }
        {ready && <ConfigCard type="story"      value={storyValue}   story={story} onPreview={onPreview} locked={true} lockedIcon="fas fa-play" lockInfo="start" />}
      </div>

      {/*totalItems.length > 0 && (
        <BonusBadgeList className="config-total-bonus" items={totalItems} />
      )*/}

      <div className="page-footer">
        {phase === 'error' ? (
          <div className="turnstile-checking">
            <p><i className="fas fa-exclamation-triangle me-2" />{t('antibot.error')}</p>
            <button className="btn-start-game" onClick={retryAntibot}>
              <i className="fas fa-sync-alt me-2" />{t('startMatch.retry')}
            </button>
          </div>
        ) : phase === 'checking' ? (
          <div className="turnstile-checking">
            <p><i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}</p>
            <TurnstileWidget
              key={attempt}
              appearance={TURNSTILE_APPEARANCE.config}
              onSuccess={tok => { setToken(tok); setPhase('ready') }}
              onError={() => setPhase('error')}
              onExpire={retryAntibot}
            />
          </div>
        ) : (
          <div className="start-game-actions">
            <button className="btn-start-game mr-5" onClick={onBack}>
              <i className="fas fa-arrow-left me-2" />{t('book.back')}
            </button>
            <button className="btn-start-game ml-5" disabled={!termsAccepted} onClick={handleStart}>
              <i className="fas fa-play me-2" />{t('book.startGame')}
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

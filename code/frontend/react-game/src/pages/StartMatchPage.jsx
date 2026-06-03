import { useState, useEffect, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/context'
import { useGuestUser } from '../context/GuestUserContext'
import Book from '../components/book/Book'
import BookPageContent from '../components/book/BookPageContent'
import BonusBadgeList from '../components/common/BonusBadgeList'
import ConfigCard from '../features/startBook/ConfigCard'
import { buildGameTypeCard, buildLoginCard } from '../features/startBook/loadoutCards'
import { aggregateBonusTotals } from '../utils/bonusStats'
import { createMatch } from '../api/matches'

/**
 * StartMatchPage (v0.19.10) — the bridge between the start book and the game.
 *
 * Reached from the start book "Start Game" button, which navigates here with
 * `{ story, config }` in the router state. The page renders a book (story card
 * on the left, the six chosen loadout cards on the right) and then:
 *   1. shows "starting match" and waits X seconds,
 *   2. calls POST /api/matches with the full loadout,
 *   3. shows "match created" and waits another X seconds,
 *   4. jumps to the game page.
 *
 * X is read from `VITE_MATCH_START_DELAY` (seconds, default 20).
 */

const DEFAULT_DELAY_SECONDS = 20

/** Resolve the configured wait, falling back to the 20s default. */
function delaySeconds() {
  const raw = Number(import.meta.env.VITE_MATCH_START_DELAY)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DELAY_SECONDS
}

export default function StartMatchPage() {
  const { storyId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useGuestUser()

  const story = state?.story ?? null
  const config = state?.config ?? null
  const cfToken = state?.cfToken ?? null

  // phase: 'starting' → 'creating' → 'created' → (game) | 'error'
  const [phase, setPhase] = useState('starting')
  const [countdown, setCountdown] = useState(delaySeconds())
  const [match, setMatch] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Direct navigation / page refresh loses the router state — there is nothing
  // to start, so send the player back to the catalog.
  useEffect(() => {
    if (!story || !config) navigate('/', { replace: true })
  }, [story, config, navigate])

  const runCreateMatch = useCallback(async () => {
    setPhase('creating')
    try {
      const payload = {
        storyUuid: story.uuid,
        difficultyUuid: config.difficulty?.uuid ?? null,
        name: story.title ?? story.name ?? null,
        characterTemplateUuid: config.character?.uuid ?? null,
        classUuid: config.class?.uuid ?? null,
        traitUuids: config.trait?.uuid ? [config.trait.uuid] : [],
        singlePlayer: 1,
        turnstileToken: cfToken,
      }
      const created = await   createMatch(payload, user?.accessToken)
      setMatch(created)
      setPhase('created')
    } catch (e) {
      console.log(e);
      const apiError = e?.response?.data?.error
      setErrorMsg(apiError || e?.message || '')
      setPhase('error')
    }
  }, [story, config, user, cfToken])

  // Timed phases: 'starting' counts down then creates the match; 'created'
  // counts down then enters the game. Both reuse the same configured delay.
  useEffect(() => {
    if (phase !== 'starting' && phase !== 'created') return undefined
    let remaining = delaySeconds()
    setCountdown(remaining)
    const id = setInterval(() => {
      remaining -= 1
      setCountdown(remaining > 0 ? remaining : 0)
      if (remaining <= 0) {
        clearInterval(id)
        if (phase === 'starting') runCreateMatch()
        else navigate(`/play/${storyId}`, { state: { matchUuid: match?.uuid } })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [phase, runCreateMatch, navigate, storyId, match])

  if (!story || !config) return null

  const cards = [
    { type: 'class',      value: config.class },
    { type: 'character',  value: config.character },
    { type: 'trait',      value: config.trait },
    { type: 'difficulty', value: config.difficulty },
    { type: 'gameType',   value: buildGameTypeCard(t) },
    { type: 'login',      value: buildLoginCard(t) },
  ]

  const totalItems = aggregateBonusTotals([
    { entity: config.character,  type: 'character' },
    { entity: config.class,      type: 'class' },
    { entity: config.trait,      type: 'trait' },
    { entity: config.difficulty, type: 'difficulty' },
  ]).map(({ category, value }) => ({
    key: category,
    label: t(`book.stats.totals.${category}`),
    value,
  }))

  const startMatchStatus=<StartMatchStatus
            phase={phase}
            countdown={countdown}
            errorMsg={errorMsg}
            onRetry={() => { setErrorMsg(''); setPhase('starting') }}
            onHome={() => navigate('/')}
            t={t}
          />

  return (
    <Book
      overlayClass="book-overlay start-match-overlay "
      wrapperClass="book-wrapper start-match-wrapper"
      mobile={<div className="book-mobile-layout">
          <BookPageContent card={story.card} story={story} loading={false} />
          {startMatchStatus}
        </div>}
      left={<BookPageContent card={story.card} story={story} loading={false} />}
      right={
        <div className="start-match-right">
          <div className="config-cards-area selection-list">
            {cards.map(c => (
              <ConfigCard key={c.type} type={c.type} value={c.value} story={story} />
            ))}
          </div>
          {/*totalItems.length > 0 && (
            <BonusBadgeList className="config-total-bonus" items={totalItems} />
          )*/}
          {startMatchStatus}
        </div>
      }
    />
  )
}

/** Bottom-of-page status block: spinner/countdown, success, or error+actions. */
function StartMatchStatus({ phase, countdown, errorMsg, onRetry, onHome, t }) {
  if (phase === 'error') {
    const isTurnstileFail = errorMsg === 'TURNSTILE_VALIDATION_FAILED'
    return ( 
      <div className="start-match-status start-match-status--error">
        <p><i className="fas fa-exclamation-triangle me-2" />{t('startMatch.error')}</p>
        {errorMsg && <p className="start-match-error-detail">{errorMsg}</p>}
        <div className="start-match-actions">
          {!isTurnstileFail && (
            <button className="btn-start-game" onClick={onRetry}>
              <i className="fas fa-sync-alt me-2" />{t('startMatch.retry')}
            </button>
          )}
          <button className="btn-start-game" onClick={onHome}>
            <i className="fas fa-home me-2" />{t('startMatch.home')}
          </button>
        </div>
      </div>
    )
  }

  const created = phase === 'created'
  const label = created ? t('startMatch.created') : t('startMatch.starting')
  const icon = created ? 'fas fa-check-circle' : 'fas fa-spinner fa-spin'

  return (
    <div className={`start-match-status${created ? ' start-match-status--ok' : ''}`}>
      <p>
        <i className={`${icon} me-2`} />
        {label}
        {countdown > 0 && (
          <span className="start-match-countdown"> ({countdown})</span>
        )}
      </p>
    </div>
  )
}

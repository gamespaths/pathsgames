import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/i18n/context'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import Book from '@/components/book/Book'
import BookPageContent from '@/components/book/BookPageContent'
import ConfigCard from '@/features/start-book/ConfigCard'
import TurnstileWidget from '@/components/ui/TurnstileWidget'
import useAntibot from '@/hooks/useAntibot'
import { TURNSTILE_APPEARANCE } from '@/utils/turnstile'
import { buildGameTypeCard, buildLoginCard, buildStatisticsCard, buildTermsCard } from '@/utils/loadoutCards'
import { createMatch, joinMatch, startMatch } from '@/api/matches'
import CardPreviewModal from '@/components/modals/CardPreviewModal'
import ConfirmStep from './ConfirmStep'
import MatchStatus from './MatchStatus'
import { buildConfigStatistics } from '@/utils/bonusStats'

/**
 * StartMatchFlow — the single match-setup surface, reached from the start book's
 * "Start Game". A book (story card left, the fixed gameType / login / terms
 * cards right) with the action area pinned to the page bottom, driving the
 * setup phases:
 *   1. antibot — Cloudflare Turnstile (fresh token sent to the backend).
 *   2. confirm — accept terms, then Start (ConfirmStep). Single-player only for
 *      now; the future multiplayer JOIN/lobby plugs in here.
 *   3. starting — countdown, then POST /api/matches with the full loadout.
 *   4. created  — countdown, then enter the game.
 * Countdown length comes from `VITE_MATCH_START_DELAY` (seconds, default 20).
 */

const DEFAULT_DELAY_SECONDS = 20

/** Resolve the configured wait, falling back to the 20s default. */
function delaySeconds() {
  const raw = Number(import.meta.env.VITE_MATCH_START_DELAY)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DELAY_SECONDS
}

export default function StartMatchFlow({ story, config, storyId }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useGuestUser()
  // Always challenge (cookie:false): the backend consumes a fresh single-use
  // token on match creation.
  const gate = useAntibot({ cookie: false })

  // phase: 'confirm' → 'starting' → 'creating' → 'joining' → 'created' | 'error'
  const [phase, setPhase] = useState('confirm')
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [countdown, setCountdown] = useState(delaySeconds())
  const [match, setMatch] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [preview,setPreview] = useState(false)

  function handleSelectionPreview(entity, entityType , lockedReason , statItemsToPageContent) {
    setPreview(entity ? { entity, entityType, lockedReason, statItemsToPageContent } : null)
    // Mobile has no left page → the (i) lens opens the big card in a modal.
    if (entity && typeof window !== 'undefined'
        && window.matchMedia?.('(max-width: 767px)').matches) {
      const el = document.getElementById('cardPreviewModal')
      const Modal = window.bootstrap?.Modal
      if (el && Modal) Modal.getOrCreateInstance(el).show()
    }
  }

  const goHome = useCallback(() => navigate('/'), [navigate])

  // Drive a visible countdown for `seconds`, resolving when it reaches 0. Used
  // to pace the creating → joining → running steps so each phase message is
  // shown with its own countdown.
  const waitWithCountdown = useCallback((seconds) => new Promise(resolve => {
    let remaining = seconds
    setCountdown(remaining)
    const id = setInterval(() => {
      remaining -= 1
      setCountdown(remaining > 0 ? remaining : 0)
      if (remaining <= 0) {
        clearInterval(id)
        resolve()
      }
    }, 1000)
  }), [])

  const runCreateMatch = useCallback(async () => {
    setPhase('creating')
    try {
      // The selected loadout is reused for both create (stored on the match)
      // and the Step 21 join (instantiates the character from it).
      // Step 23 — every selected trait is sent; the backend validates the
      // class restrictions and the difficulty cost budgets.
      const selectedTraits = Array.isArray(config.traits)
        ? config.traits
        : (config.trait ? [config.trait] : [])
      const loadout = {
        characterTemplateUuid: config.character?.uuid ?? null,
        classUuid: config.class?.uuid ?? null,
        traitUuids: selectedTraits.map(tr => tr?.uuid).filter(Boolean),
      }
      const payload = {
        storyUuid: story.uuid,
        difficultyUuid: config.difficulty?.uuid ?? null,
        name: story.title ?? story.name ?? null,
        ...loadout,
        singlePlayer: 1,
        turnstileToken: gate.token,
      }
      const created = await createMatch(payload, user?.accessToken)
      setMatch(created)
      await waitWithCountdown(delaySeconds())
      // Step 21 — auto-join: materialise the character in the freshly created
      // match before entering the game.
      setPhase('joining')
      await joinMatch(created.uuid, loadout, user?.accessToken)
      await waitWithCountdown(delaySeconds())
      // Step — transition the match CREATED → RUNNING so gameplay actions
      // (sleep / pass-turn) are accepted; without this they 409 MATCH_NOT_RUNNING.
      setPhase('running')
      await startMatch(created.uuid, user?.accessToken)
      await waitWithCountdown(delaySeconds())
      setPhase('created')
    } catch (e) {
      const apiError = e?.response?.data?.error
      setErrorMsg(apiError || e?.message || '')
      setPhase('error')
    }
  }, [story, config, user, gate.token, waitWithCountdown])

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

  // The (i) lens on the terms card opens the shared Terms & Conditions modal.
  function openTermsModal() {
    const el = document.getElementById('termsModal')
    const Modal = window.bootstrap?.Modal
    if (el && Modal) Modal.getOrCreateInstance(el).show()
  }

  //statistics
  const statistics = buildConfigStatistics(config, t);
  const statisticsCard= buildStatisticsCard(t, statistics , story);

  // Fixed cards shown in EVERY phase: game type, login mode and the terms
  // (the only interactive one — its toggle gates the Start button).
  const cardsBlock = (
    <div className="selection-list">
      <ConfigCard type="story" value={{ card: story.card }} story={story} flagInformationCard={true}  onPreview={handleSelectionPreview} />
        <ConfigCard type="statistics"   value={statisticsCard} flagInformationCard={true} onPreview={handleSelectionPreview}
          statistics={statistics.filter(cat => ['dexterity', 'intelligence' , 'constitution' ].includes(cat.key))} />
        <ConfigCard type="statistics"   value={statisticsCard} flagInformationCard={true}   onPreview={handleSelectionPreview}
          statistics={statistics.filter(cat => ['life', 'energy' , 'sad', 'weight'].includes(cat.key))} />
      <ConfigCard type="gameType" value={buildGameTypeCard(t)} story={story} locked onPreview={handleSelectionPreview} />
      <ConfigCard type="login"    value={buildLoginCard(t)}    story={story} locked onPreview={handleSelectionPreview} />
      <ConfigCard
        type="terms"
        value={buildTermsCard(t)}
        story={story}
        selected={termsAccepted}
        onSelect={() => setTermsAccepted(v => !v)}
        onPreview={openTermsModal}
        selectLabel={termsAccepted ? t('book.accepted') : t('book.accept')}
      />
    </div>
  )

  // Bottom action area (pinned to the page bottom): antibot → confirm → status.
  let bottom
  if (gate.phase === 'checking' || gate.phase === 'error') {
    bottom = <AntibotBlock gate={gate} t={t} onHome={goHome} />
  } else if (phase === 'confirm') {
    // Single-player for now; future multiplayer JOIN/lobby branches here.
    bottom = (
      <ConfirmStep
        termsAccepted={termsAccepted}
        onStart={() => setPhase('starting')}
        onHome={goHome}
      />
    )
  } else {
    bottom = (
      <MatchStatus
        phase={phase}
        countdown={countdown}
        errorMsg={errorMsg}
        onRetry={() => { setErrorMsg(''); setPhase('starting') }}
        onHome={goHome}
        t={t}
      />
    )
  }

  return (
    <>
    <Book
      overlayClass="book-overlay start-match-overlay "
      wrapperClass="book-wrapper start-match-wrapper"
      mobile={
        <div className="book-mobile-layout">
          <BookPageContent card={story.card} story={story} loading={false} />
          <div className="start-match-cards">{cardsBlock}</div>
          <div className="start-match-footer">{bottom}</div>
        </div>
      }
      left={ preview 
        ? <BookPageContent loading={false}
                card={preview.entity?.card}
                entity={preview.entity}
                entityType={preview.entityType}
                story={story}
                statItemsToPageContent={preview.statItemsToPageContent}
              />
        : <BookPageContent card={story.card} story={story} loading={false} />}
      right={
        <div className="start-match-right">
          <div className="start-match-cards">{cardsBlock}</div>
          <div className="start-match-footer">{bottom}</div>
        </div>
      }
    />
    {/* Mobile (i) preview: the big card shown in a Bootstrap modal. */}
    <CardPreviewModal preview={preview ? { entity: preview.entity, type: preview.entityType } : null} story={story} />
    </>
  )
}

/** Antibot verification block (verifying spinner + widget, or error + actions). */
function AntibotBlock({ gate, t, onHome }) {
  if (gate.phase === 'error') {
    return (
      <div className="start-match-status start-match-status--error">
        <p><i className="fas fa-exclamation-triangle me-2" />{t('antibot.error')}</p>
        <div className="start-match-actions">
          <button className="btn-start-game" onClick={gate.retry}>
            <i className="fas fa-sync-alt me-2" />{t('startMatch.retry')}
          </button>
          <button className="btn-start-game" onClick={onHome}>
            <i className="fas fa-home me-2" />{t('startMatch.home')}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="start-match-status">
      <p><i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}</p>
      <TurnstileWidget
        key={gate.attempt}
        appearance={TURNSTILE_APPEARANCE.config}
        onSuccess={gate.onSuccess}
        onError={gate.onError}
        onExpire={gate.onExpire}
      />
    </div>
  )
}

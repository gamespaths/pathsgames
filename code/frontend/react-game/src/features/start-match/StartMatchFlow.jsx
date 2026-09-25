import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/i18n/context'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import { usePolicyBook } from '@/context/PolicyBookContext'
import Book from '@/components/book/Book'
import Card from '@/components/layout/Card'
import TurnstileWidget from '@/components/ui/TurnstileWidget'
import useAntibot from '@/hooks/useAntibot'
import { TURNSTILE_APPEARANCE } from '@/utils/turnstile'
import { buildCharacterAttributesCard, buildGameTypeCard, buildLoginCard, buildPhaseCard, buildStatisticsCard, buildTermsCard } from '@/utils/loadoutCards'
import { createMatch, joinMatch, startMatch } from '@/api/matches'
import CardPreviewModal from '@/components/modals/CardPreviewModal'
// import ConfirmStep from './ConfirmStep' — "Start" moved onto the second bonuses card (v0.38.3).
import MatchStatus from './MatchStatus'
import { buildConfigStatistics } from '@/utils/bonusStats'
import { traitBudgetItems } from '@/utils/traitBudget'

/**
 * StartMatchFlow — the single match-setup surface, reached from the start book's
 * "Start". A book (story card left, the fixed gameType / login / terms
 * cards right) with the status area pinned to the page bottom, driving the
 * setup phases:
 *   1. antibot — Cloudflare Turnstile (fresh token sent to the backend).
 *   2. confirm — accept terms, then Start (the action of the last bonuses card,
 *      locked until the gate passed). Single-player only for now; the future
 *      multiplayer JOIN/lobby plugs in here.
 *   3. starting — countdown, then POST /api/matches with the full loadout.
 *   4. created  — countdown, then enter the game.
 * Once Start is pressed the six cards give way to one card per phase (story first,
 * then creating / joining / running / created), each spinning while it runs and
 * checked once done. Countdown length comes from `VITE_MATCH_START_DELAY`
 * (seconds, default 20).
 */

const DEFAULT_DELAY_SECONDS = 20

/** The phase cards, in order; 'starting' counts down on the first one. */
const PHASES = ['creating', 'joining', 'running', 'created']

/** Index of the phase card the flow is on (-1 before Start). */
function activePhaseIndex(phase) {
  const i = PHASES.indexOf(phase)
  return i >= 0 ? i : (phase === 'starting' ? 0 : -1)
}

const PHASE_STATUS_ICON = {
  pending: 'fas fa-hourglass-half',
  inProgress: 'fas fa-spinner fa-spin',
  complete: 'fas fa-check',
  failed: 'fas fa-exclamation-triangle',
}

/** Resolve the configured wait, falling back to the 20s default. */
function delaySeconds() {
  const raw = Number(import.meta.env.VITE_MATCH_START_DELAY)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DELAY_SECONDS
}

export default function StartMatchFlow({ story, config, storyId }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { openPolicyBook } = usePolicyBook()
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
  // The phase whose call failed: its card reads "failed", the ones before it stay done.
  const [failedPhase, setFailedPhase] = useState(null)
  const [preview,setPreview] = useState(false)
  // Retry pending a fresh Turnstile token (the failed one is already burnt).
  const [retryPending, setRetryPending] = useState(false)
  // Read through a ref so an auto-refreshed token never restarts the countdown.
  const tokenRef = useRef(gate.token)
  useEffect(() => { tokenRef.current = gate.token }, [gate.token])

  function handleSelectionPreview(card, entityType , lockedReason , statItemsToPageContent) {
    setPreview(card ? { card, entityType, lockedReason, statItemsToPageContent } : null)
    // Mobile has no left page → the (i) lens opens the big card in a modal.
    if (card && typeof window !== 'undefined'
        && window.matchMedia?.('(max-width: 767px)').matches) {
      const el = document.getElementById('cardPreviewModal')
      const Modal = window.bootstrap?.Modal
      if (el && Modal) Modal.getOrCreateInstance(el).show()
    }
  }

  const goHome = useCallback(() => navigate('/'), [navigate])
  // Back to the start book, with this loadout still selected (HomePage reopens the modal).
  const goBackToBook = useCallback(
    () => navigate('/', { state: { reopenStory: story, reopenConfig: config } }),
    [navigate, story, config])

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
    let step = 'creating'
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
        turnstileToken: tokenRef.current,
      }
      const created = await createMatch(payload, user?.accessToken, user?.csrfToken)
      setMatch(created)
      await waitWithCountdown(delaySeconds())
      // Step 21 — auto-join: materialise the character in the freshly created
      // match before entering the game.
      step = 'joining'
      setPhase('joining')
      await joinMatch(created.uuid, loadout, user?.accessToken)
      await waitWithCountdown(delaySeconds())
      // Step — transition the match CREATED → RUNNING so gameplay actions
      // (sleep / pass-turn) are accepted; without this they 409 MATCH_NOT_RUNNING.
      step = 'running'
      setPhase('running')
      await startMatch(created.uuid, user?.accessToken)
      await waitWithCountdown(delaySeconds())
      setPhase('created')
    } catch (e) {
      const apiError = e?.response?.data?.error
      // v0.32.1 — the backend refuses a second match on a story the player is
      // already playing. It is a rule, not a failure: say it in plain words
      // instead of showing the raw error code.
      setErrorMsg(apiError === 'ACTIVE_MATCH_ALREADY_EXISTS'
        ? t('startMatch.errorActiveMatch')
        : (apiError || e?.message || ''))
      setFailedPhase(step)
      setPhase('error')
    }
  }, [story, config, user, waitWithCountdown, t])

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

  // A retry never reuses `gate.token`: Turnstile tokens are single-use, so a
  // second POST with the same one always fails. Re-challenge, then resume.
  function handleRetry() {
    setErrorMsg('')
    setFailedPhase(null)
    setRetryPending(true)
    gate.retry()
  }

  useEffect(() => {
    if (retryPending && gate.phase === 'ready') {
      setRetryPending(false)
      setPhase('starting')
    }
  }, [retryPending, gate.phase])

  // The (i) lens on the terms card opens the Terms & Conditions book.
  const openTermsModal = () => openPolicyBook('terms')

  //statistics — first card: characteristics + carry; second: pools + trait cost used/max.
  // The (i) of the first opens the attributes page (every non-zero attribute, then that cost).
  const statistics = buildConfigStatistics(config, t);
  const statisticsCard= buildStatisticsCard(t, statistics , story);
  const selectedTraitsForBadges = Array.isArray(config.traits) ? config.traits : (config.trait ? [config.trait] : [])
  const budgetItems = traitBudgetItems(config.difficulty, selectedTraitsForBadges, t)
  const statisticCard1 = statistics.filter(cat => ['dexterity', 'intelligence', 'constitution', 'weight'].includes(cat.key)) ;
  const statisticCard2 = statistics.filter(cat => ['life', 'energy', 'sad'].includes(cat.key)).concat(budgetItems) ;
  const attributesCard = buildCharacterAttributesCard(t)
  const attributesStats = statistics.concat(budgetItems)

  // "Start" is the action of the last bonuses card: locked while the antibot gate is still
  // checking, while the terms are not accepted, and again once the match is being created.
  const startReady = gate.phase === 'ready' && termsAccepted && phase === 'confirm'
  const startLockReason = gate.phase !== 'ready' ? t('antibot.verifying')
    : !termsAccepted ? t('startMatch.acceptTermsFirst')
    : t('startMatch.starting')

  // Fixed cards shown in EVERY phase: game type, login mode and the terms
  // (the only interactive one — its toggle gates the Start action).
  const cardsBlock = (
    <div className="selection-list">
      <Card card={story.card} entityType="story" label={t('book.story')} story={story} flagInformationCard={false} 
        onPreview={() => handleSelectionPreview(story.card,"story")}
        onAction={goBackToBook} actionLabel={t('book.back')} actionIcon="fa-arrow-left" />
      <Card card={buildGameTypeCard(t)} entityType="gameType" label={t('book.single')} 
        onPreview={() => handleSelectionPreview(buildGameTypeCard(t),"gameType")} story={story} locked
        lockInfo={{ kind: 'gameType', label: t('book.singlePlayer') }} />
      <Card card={statisticsCard} entityType="bonuses" 
        onPreview={() => handleSelectionPreview(attributesCard,"bonuses", null ,attributesStats) }       
        flagInformationCard={true}
        statistics={statisticCard1} flagShowFullStatistics={true} 
         />
      <Card card={buildLoginCard(t)} entityType="login" label={t('book.login')} 
        onPreview={() => handleSelectionPreview(buildLoginCard(t),"login")} story={story} locked
        lockInfo={{ kind: 'login', label: t('book.guestLock') }} />
      <Card card={buildTermsCard(t)} entityType="terms" label={t('book.terms')} 
        onPreview={openTermsModal}
        onSelect={() => setTermsAccepted(v => !v)}
        selectLabel={termsAccepted ? t('book.accepted') : t('book.accept')}
        story={story}
        selected={termsAccepted}
      />
      <Card card={statisticsCard} entityType="bonuses" 
        onPreview={() => handleSelectionPreview(statisticsCard,"bonuses", null ,statisticCard2)}  
        flagInformationCard={false}  hidePreview={true}
        statistics={statisticCard2} flagShowFullStatistics={true}
        onAction={startReady ? () => setPhase('starting') : undefined}
        actionLabel={t('book.start')} actionIcon="fa-play"
        locked={!startReady} lockInfo={{ kind: 'start', label: t('book.start') }}
        lockedReason={startLockReason}
        lockedIcon={gate.phase === 'checking' ? 'fas fa-spinner fa-spin' : 'fas fa-lock'} />
    </div>
  )

  // After Start: the story card (checked, "starting") then one card per phase, each locked
  // under its own status — pending, spinning with the countdown, complete, or failed.
  const activeIndex = phase === 'error' ? PHASES.indexOf(failedPhase) : activePhaseIndex(phase)
  const phaseStatus = (i) => PHASES[i] === failedPhase ? 'failed'
    : i < activeIndex ? 'complete' : i === activeIndex ? 'inProgress' : 'pending'
  const phaseLabel = (status) => status === 'inProgress' && countdown > 0
    ? `${t('startMatch.phaseInProgress')} (${countdown})`
    : t(`startMatch.phase${status.charAt(0).toUpperCase()}${status.slice(1)}`)
  const phasesBlock = (
    <div className="selection-list">
      <Card card={story.card} entityType="story" label={t('book.story')} story={story}
        locked lockedIcon="fas fa-check" lockInfo={{ kind: 'phase', label: t('startMatch.phaseStarting') }}
        additionalCardClasses="pg-card--phase pg-card--phase-complete" />
      {PHASES.map((p, i) => {
        const status = phaseStatus(i)
        return (
          <Card key={p} card={buildPhaseCard(p, t(`startMatch.phaseTitle.${p}`))} entityType="phase" story={story}
            locked lockedIcon={PHASE_STATUS_ICON[status]} lockInfo={{ kind: 'phase', label: phaseLabel(status) }}
            lockedReason={status === 'failed' ? errorMsg || undefined : undefined}
            additionalCardClasses={`pg-card--phase pg-card--phase-${status}`} />
        )
      })}
    </div>
  )
  const boardBlock = phase === 'confirm' ? cardsBlock : phasesBlock

  // The widget stays mounted for the whole flow (hidden once passed): unmounting
  // it kills Turnstile's auto-refresh and the 300s token expires before the POST.
  const antibotWidget = (
    <div className="start-match-antibot" hidden={gate.phase === 'ready'}>
      <TurnstileWidget
        key={gate.attempt}
        appearance={TURNSTILE_APPEARANCE.config}
        onSuccess={gate.onSuccess}
        onError={gate.onError}
        onExpire={gate.onExpire}
      />
    </div>
  )

  // Bottom status area (pinned to the page bottom): antibot, or the error with its retry.
  // Nothing while confirming (Start sits on its card) nor while the phase cards run.
  let bottom = null
  if (gate.phase === 'checking' || gate.phase === 'error') {
    bottom = <AntibotBlock gate={gate} t={t} />
  /* } else if (phase === 'confirm') {
    // Single-player for now; future multiplayer JOIN/lobby branches here.
    bottom = (
      <ConfirmStep
        termsAccepted={termsAccepted}
        onStart={() => setPhase('starting')}
        onHome={goHome}
      />
    ) */
  } else if (phase === 'error') {
    bottom = (
      <MatchStatus
        phase={phase}
        countdown={countdown}
        errorMsg={errorMsg}
        onRetry={handleRetry}
        t={t}
      />
    )
  }

  return (
    <>
    <Book
      overlayClass="book-overlay start-match-overlay "
      wrapperClass="book-wrapper start-match-wrapper"
      onClose={goHome}
      mobile={
        <div className="book-mobile-layout">
          <Card variant="page" card={story.card} story={story} loading={false} />
          <div className="start-match-cards">{boardBlock}</div>
          <div className="start-match-footer">{antibotWidget}{bottom}</div>
        </div>
      }
      left={ preview 
        ? <Card variant="page" loading={false}
                card={preview.card}
                entityType={preview.entityType}
                story={story}
                statItemsToPageContent={preview.statItemsToPageContent}
              />
        : <Card variant="page" card={story.card} story={story} loading={false} />}
      right={
        <div className="start-match-right">
          <div className="start-match-cards">{boardBlock}</div>
          <div className="start-match-footer">{antibotWidget}{bottom}</div>
        </div>
      }
    />
    {/* Mobile (i) preview: the big card shown in a Bootstrap modal. */}
    <CardPreviewModal preview={preview ? { card: preview.card, type: preview.entityType } : null} story={story} />
    </>
  )
}

/** Antibot verification block (verifying spinner, or error + retry); the
 * Turnstile widget itself lives in the flow so it is never unmounted. */
function AntibotBlock({ gate, t }) {
  if (gate.phase === 'error') {
    return (
      <div className="start-match-status start-match-status--error">
        <p><i className="fas fa-exclamation-triangle me-2" />{t('antibot.error')}</p>
        <div className="start-match-actions">
          <button className="btn-start-game" onClick={gate.retry}>
            <i className="fas fa-sync-alt me-2" />{t('startMatch.retry')}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="start-match-status">
      <p><i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}</p>
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from '@/i18n/context'
import { useGuestUser } from './GuestUserContext'
import Book from '@/components/book/Book'
import Card from '@/components/layout/Card'
import UserMatchesList from './UserMatchesList'
import MatchLogCard from '@/features/matches/MatchLogCard'
import MatchHistoryCard from '@/features/matches/MatchHistoryCard'
import useMatchMissions from '@/features/matches/useMatchMissions'
import MissionCards from '@/features/gameplay/cards/MissionCards'
import MissionStepsCards from '@/features/gameplay/cards/MissionStepsCards'
import LoadingCard from '@/components/layout/LoadingCard'
import PreferencesEditor from '@/features/preferences/PreferencesEditor'
import UserAccountPanel, { UserAvatar } from './UserAccountPanel'
import SafeHtml from '@/components/ui/SafeHtml'
import TurnstileWidget from '@/components/ui/TurnstileWidget'
import { CF_KEY, TURNSTILE_APPEARANCE, isTurnstilePassValid, recordTurnstilePass } from '@/utils/turnstile'
import useBookTurn from '@/hooks/useBookTurn'

/**
 * PlayerBook — v1.13.0: the book of the `/player` page (was the GuestUserModal overlay): the
 * player's identity on the left page and the matches on the right page. PlayerPage hosts it.
 *
 * Clicking (i) on a MatchCard puts the story card on the left page and, v0.37.4, the match's
 * MISSIONS on the right — each openable down to its steps — with a "Match History" card
 * closing the grid that opens the timeline. A back-arrow returns one page at a time.
 * Step 15 — opening a match, a mission or the history turns forward, every back arrow back; a step (i) fades.
 * Step 16 — the preferences card opens the editor on the right page (forward); the language buttons live there now.
 */
export default function PlayerBook() {
  const { t, lang } = useTranslation()
  const { user, loading, matches } = useGuestUser()
  // The list the opener handed over, read once: the page clears the context copy on unmount.
  const [preloadedMatches] = useState(matches)
  const [previewInfo, setPreviewInfo] = useState(null) // { card, story, statusLabel, match }
  // What the right page reads for the previewed match: 'missions' | 'missionSteps' | 'history'
  const [matchView, setMatchView] = useState('missions')
  // The mission opened from the grid ({ mission, card, stats }) and a step's own (i) card.
  const [selected, setSelected] = useState(null)
  const [stepPreview, setStepPreview] = useState(null)
  // Step 40 — History opened straight from the list: its back arrow returns to the list.
  const [historyFromList, setHistoryFromList] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const matchUuid = previewInfo?.match?.uuid ?? null
  const missions = useMatchMissions(matchUuid, user?.accessToken, lang)
  // 'checking' until Turnstile passes, then 'human'; 'bot' on failure. The
  // matches list is shown only once cleared. No site key — or a still-valid
  // recent pass cookie — skips straight to human (no re-verify).
  const [status, setStatus] = useState(!CF_KEY || isTurnstilePassValid() ? 'human' : 'checking')
  const [attempt, setAttempt] = useState(0)
  const { pageKey, direction, turnTo } = useBookTurn()

  // Re-mount the widget (fresh challenge) instead of permanently blocking.
  function retryAntibot() {
    setAttempt(a => a + 1)
    setStatus('checking')
  }

  // v1.2.0 — the displayName (Google: "given family", else name, else nickname) titles the card
  const username    = user?.displayName ?? user?.username ?? t('modals.guestUser.anonymous')
  const isGoogle    = user?.accountType === 'GOOGLE'
  // v1.2.0 — the Google picture before the name; the sign-in / logout panel in the parchment body
  const title       = isGoogle && user?.pictureUrl ? <span><UserAvatar url={user.pictureUrl} />{username}</span> : username
  const description = <>
    <SafeHtml value={t(isGoogle ? 'modals.guestUser.bodyGoogle' : 'modals.guestUser.body')} halfBlankLines />
    <UserAccountPanel />
  </>
  const userCard    = { title, description, urlImage: null, linkCopyright: null }

  function openPreferences() {
    setPrefsOpen(true)
    turnTo('forward')
  }
  function closePreferences() {
    setPrefsOpen(false)
    turnTo('back')
  }
  function closePreview() {
    setPreviewInfo(null)
    setMatchView('missions')
    setSelected(null)
    setStepPreview(null)
    setHistoryFromList(false)
    turnTo('back')
  }
  function openPreview(info) {
    setMatchView('missions')
    setSelected(null)
    setStepPreview(null)
    setHistoryFromList(false)
    setPreviewInfo(info)
    turnTo('forward')
  }
  function openHistory(info) {
    openPreview(info)
    setMatchView('history')
    setHistoryFromList(true)
  }
  function openMission({ mission, card, stats = [] }) {
    setStepPreview(null)
    setSelected({ mission, card, stats })
    setMatchView('missionSteps')
    turnTo('forward')
  }
  function backToMissions() {
    setStepPreview(null)
    setSelected(null)
    setMatchView('missions')
    turnTo('back')
  }
  function openHistoryFromGrid() {
    setMatchView('history')
    turnTo('forward')
  }
  function showStep(card, type, stats) {
    setStepPreview(card ? { card, type, stats } : null)
    turnTo('fade')
  }

  const story = previewInfo?.story ?? null
  const leftPage = !previewInfo
    ? <Card variant="page" card={userCard} loading={loading} />
    : matchView === 'missionSteps' && selected
      ? <Card variant="page" card={selected.card} entityType="missions" loading={false}
          story={story} onClose={backToMissions} bonusBadgeShowZeros
          statItemsToPageContent={selected.stats} hidePreview />
      : <Card variant="page"
          card={previewInfo.card ?? { title: story?.title ?? t('matches.unknownStory'), description: previewInfo.statusLabel }}
          story={story} entityType="story"
          loading={false}
          onClose={closePreview}
        ></Card>

  // (i) on a MatchCard: the story card takes the left page and the match's missions the
  // right one, in place of the matches list; the history is a card among them. Each back
  // arrow turns one page back: step → steps → missions → the list.
  let rightPage
  if (prefsOpen) {
    rightPage = <PreferencesEditor onBack={closePreferences} />
  } else if (matchUuid && matchView === 'history') {
    rightPage = <MatchLogCard matchUuid={matchUuid} accessToken={user?.accessToken}
      story={story} match={previewInfo?.match ?? null}
      onBack={historyFromList ? closePreview : backToMissions} />
  } else if (matchUuid && stepPreview) {
    rightPage = <Card variant="page" card={stepPreview.card} entityType={stepPreview.type}
      loading={false} story={story} onClose={() => showStep(null)}
      statItemsToPageContent={stepPreview.stats} />
  } else if (matchUuid && matchView === 'missionSteps' && selected) {
    rightPage = <MissionStepsCards mission={selected.mission} story={story}
      onPreview={({ card, type, stats }) => showStep(card, type, stats)}
      previewSide="right" />
  } else if (matchUuid && missions.loading) {
    rightPage = <LoadingCard story={story} />
  } else if (matchUuid) {
    rightPage = (
      <MissionCards missions={missions.missions} story={story} previewSide="right"
        onOpenMission={openMission}>
        {!previewInfo?.missionsOnly && <MatchHistoryCard story={story} onOpen={openHistoryFromGrid} />}
      </MissionCards>
    )
  } else rightPage = <>

    {status === 'error' ? (
      <div className="turnstile-checking">
        <p><i className="fas fa-exclamation-triangle me-2" />{t('antibot.error')}</p>
        <button className="btn-start-game" onClick={retryAntibot}>
          <i className="fas fa-sync-alt me-2" />{t('startMatch.retry')}
        </button>
      </div>
    ) : status === 'checking' ? (
      <div className="turnstile-checking">
        <p><i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}</p>
        <TurnstileWidget
          key={attempt}
          appearance={TURNSTILE_APPEARANCE.guest}
          onSuccess={() => { recordTurnstilePass(); setStatus('human') }}
          onError={() => setStatus('error')}
          onExpire={retryAntibot}
        />
      </div>
    ) : (
      <UserMatchesList
        accessToken={user?.accessToken}
        preloadedMatches={preloadedMatches}
        onPreviewCard={openPreview}
        onOpenHistory={openHistory}
        onOpenPreferences={openPreferences}
      />
    )}
  </>

  return (
    <Book
      left={leftPage}
      right={rightPage}
      pageKey={pageKey}
      direction={direction}
    />
  )
}

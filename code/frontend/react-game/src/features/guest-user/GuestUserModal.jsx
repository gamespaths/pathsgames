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
import UserLanguageSelector from './UserLanguageSelector'
import TurnstileWidget from '@/components/ui/TurnstileWidget'
import { CF_KEY, TURNSTILE_APPEARANCE, isTurnstilePassValid, recordTurnstilePass } from '@/utils/turnstile'

/**
 * GuestUserModal — book-style overlay showing the guest identity on the left
 * page and the user's matches on the right page.
 *
 * Clicking (i) on a MatchCard puts the story card on the left page and, v0.37.4, the match's
 * MISSIONS on the right — each openable down to its steps — with a "Match History" card
 * closing the grid that opens the timeline. A back-arrow returns one page at a time.
 */
export default function GuestUserModal() {
  const { t, lang } = useTranslation()
  const { user, loading, guestModalOpen, closeGuestModal, matches } = useGuestUser()
  const [previewInfo, setPreviewInfo] = useState(null) // { card, story, statusLabel, match }
  // What the right page reads for the previewed match: 'missions' | 'missionSteps' | 'history'
  const [matchView, setMatchView] = useState('missions')
  // The mission opened from the grid ({ mission, card, stats }) and a step's own (i) card.
  const [selected, setSelected] = useState(null)
  const [stepPreview, setStepPreview] = useState(null)
  const matchUuid = previewInfo?.match?.uuid ?? null
  const missions = useMatchMissions(matchUuid, user?.accessToken, lang)
  // 'checking' until Turnstile passes, then 'human'; 'bot' on failure. The
  // matches list is shown only once cleared. No site key — or a still-valid
  // recent pass cookie — skips straight to human (no re-verify).
  const [status, setStatus] = useState(!CF_KEY || isTurnstilePassValid() ? 'human' : 'checking')
  const [attempt, setAttempt] = useState(0)

  // Re-mount the widget (fresh challenge) instead of permanently blocking.
  function retryAntibot() {
    setAttempt(a => a + 1)
    setStatus('checking')
  }

  if (!guestModalOpen) return null

  const username    = user?.username ?? t('modals.guestUser.anonymous')
  const description = t('modals.guestUser.body')
  const userCard    = { title: username, description, urlImage: null, linkCopyright: null }

  function closePreview() {
    setPreviewInfo(null)
    setMatchView('missions')
    setSelected(null)
    setStepPreview(null)
  }
  function openPreview(info) {
    setMatchView('missions')
    setSelected(null)
    setStepPreview(null)
    setPreviewInfo(info)
  }
  function openMission({ mission, card, stats = [] }) {
    setStepPreview(null)
    setSelected({ mission, card, stats })
    setMatchView('missionSteps')
  }
  function backToMissions() {
    setStepPreview(null)
    setSelected(null)
    setMatchView('missions')
  }

  const story = previewInfo?.story ?? null
  const leftPage = !previewInfo
    ? <Card variant="page" card={userCard} loading={loading} extraContent={<UserLanguageSelector />} />
    : matchView === 'missionSteps' && selected
      ? <Card variant="page" card={selected.card} entityType="missions" loading={false}
          story={story} onClose={backToMissions} bonusBadgeShowZeros
          statItemsToPageContent={selected.stats} hidePreview />
      : <Card variant="page"
          card={previewInfo.card ?? { title: story?.title ?? t('matches.unknownStory'), description: previewInfo.statusLabel }}
          story={story}
          loading={false}
          onClose={closePreview}
        ></Card>

  // (i) on a MatchCard: the story card takes the left page and the match's missions the
  // right one, in place of the matches list; the history is a card among them. Each back
  // arrow turns one page back: step → steps → missions → the list.
  let rightPage
  if (matchUuid && matchView === 'history') {
    rightPage = <MatchLogCard matchUuid={matchUuid} accessToken={user?.accessToken}
      story={story} onBack={backToMissions} />
  } else if (matchUuid && stepPreview) {
    rightPage = <Card variant="page" card={stepPreview.card} entityType={stepPreview.type}
      loading={false} story={story} onClose={() => setStepPreview(null)} />
  } else if (matchUuid && matchView === 'missionSteps' && selected) {
    rightPage = <MissionStepsCards mission={selected.mission} story={story}
      onPreview={({ card, type }) => setStepPreview(card ? { card, type } : null)}
      previewSide="right" />
  } else if (matchUuid && missions.loading) {
    rightPage = <LoadingCard story={story} />
  } else if (matchUuid) {
    rightPage = (
      <MissionCards missions={missions.missions} story={story} previewSide="right"
        onOpenMission={openMission}>
        <MatchHistoryCard story={story} onOpen={() => setMatchView('history')} />
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
        preloadedMatches={matches}
        onPreviewCard={openPreview}
        onClose={closeGuestModal}
      />
    )}
  </>

  return (
    <Book
      onClose={closeGuestModal}
      left={leftPage}
      right={rightPage}
      mobile={
        <div className="book-mobile-layout">
          {/* Big user (or previewed story) card on top, then the matches grid
              laid out two per row below it. */}
          {leftPage}
          {rightPage}
        </div>
      }
    />
  )
}

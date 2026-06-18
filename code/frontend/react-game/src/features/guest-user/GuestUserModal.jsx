import { useState } from 'react'
import { useTranslation } from '@/i18n/context'
import { useGuestUser } from './GuestUserContext'
import Book from '@/components/book/Book'
import Card from '@/components/layout/Card'
import UserMatchesList from './UserMatchesList'
import UserLanguageSelector from './UserLanguageSelector'
import TurnstileWidget from '@/components/ui/TurnstileWidget'
import { CF_KEY, TURNSTILE_APPEARANCE, isTurnstilePassValid, recordTurnstilePass } from '@/utils/turnstile'

/**
 * GuestUserModal — book-style overlay showing the guest identity on the left
 * page and the user's match history on the right page.
 *
 * Clicking (i) on a MatchCard updates the left page with the story card.
 * A back-arrow in BookPageContent returns to the user identity card.
 */
export default function GuestUserModal() {
  const { t } = useTranslation()
  const { user, loading, guestModalOpen, closeGuestModal, matches } = useGuestUser()
  const [previewInfo, setPreviewInfo] = useState(null) // { card, story, statusLabel, match }
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

  const leftPage = previewInfo
    ? (
      <Card variant="page"
        card={previewInfo.card ?? { title: previewInfo.story?.title ?? t('matches.unknownStory'), description: previewInfo.statusLabel }}
        story={previewInfo.story}
        loading={false}
        onClose={() => setPreviewInfo(null)}
      ></Card>
    )
    : <Card variant="page" card={userCard} loading={loading} extraContent={<UserLanguageSelector />} />

  const rightPage = <>
    
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
        onPreviewCard={setPreviewInfo}
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

import { useState } from 'react'
import { useTranslation } from '../../../i18n/context'
import { useGuestUser } from '../../../context/GuestUserContext'
import Book from '../../book/Book'
import BookPageContent from '../../book/BookPageContent'
import UserMatchesList from './UserMatchesList'
import UserLanguageSelector from './UserLanguageSelector'
import TurnstileWidget from '../../common/TurnstileWidget'
import AntibotMessage from '../../common/AntibotMessage'
import { CF_KEY, TURNSTILE_APPEARANCE, isTurnstilePassValid, recordTurnstilePass } from '../../../utils/turnstile'

/**
 * GuestUserModal — book-style overlay showing the guest identity on the left
 * page and the user's match history on the right page.
 *
 * Clicking (i) on a MatchCard updates the left page with the story card.
 * A back-arrow in BookPageContent returns to the user identity card.
 */
export default function GuestUserModal() {
  const { t } = useTranslation()
  const { user, loading, guestModalOpen, closeGuestModal } = useGuestUser()
  const [previewInfo, setPreviewInfo] = useState(null) // { card, story, statusLabel, match }
  // 'checking' until Turnstile passes, then 'human'; 'bot' on failure. The
  // matches list is shown only once cleared. No site key — or a still-valid
  // recent pass cookie — skips straight to human (no re-verify).
  const [status, setStatus] = useState(!CF_KEY || isTurnstilePassValid() ? 'human' : 'checking')

  if (!guestModalOpen) return null

  const username    = user?.username ?? t('modals.guestUser.anonymous')
  const description = t('modals.guestUser.body')
  const userCard    = { title: username, description, urlImage: null, linkCopyright: null }

  const leftPage = previewInfo
    ? (
      <BookPageContent
        card={previewInfo.card ?? { title: previewInfo.story?.title ?? t('matches.unknownStory'), description: previewInfo.statusLabel }}
        story={previewInfo.story}
        loading={false}
        onClose={() => setPreviewInfo(null)}
      ></BookPageContent>
    )
    : <BookPageContent card={userCard} loading={loading} extraContent={<UserLanguageSelector />} />

  const rightPage = <>
    
    {status === 'bot' ? (
      <AntibotMessage />
    ) : status === 'checking' ? (
      <div className="turnstile-checking">
        <p><i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}</p>
        <TurnstileWidget
          appearance={TURNSTILE_APPEARANCE.guest}
          onSuccess={() => { recordTurnstilePass(); setStatus('human') }}
          onError={() => setStatus('bot')}
          onExpire={() => setStatus('bot')}
        />
      </div>
    ) : (
      <UserMatchesList
        accessToken={user?.accessToken}
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

    />
  )
}

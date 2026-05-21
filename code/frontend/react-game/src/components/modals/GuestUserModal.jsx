import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import { useGuestUser } from '../../context/GuestUserContext'
import Book from '../book/Book'
import BookPageContent from '../book/BookPageContent'
import UserMatchesList from '../../features/matches/UserMatchesList'

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
      />
    )
    : <BookPageContent card={userCard} loading={loading} />

  return (
    <Book
      onClose={closeGuestModal}
      left={leftPage}
      right={
        <UserMatchesList
          accessToken={user?.accessToken}
          onPreviewCard={setPreviewInfo}
        />
      }
    />
  )
}

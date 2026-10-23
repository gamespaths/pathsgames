import { useEffect, useRef } from 'react'
import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { profileStatBadges } from '@/utils/profileStats'
import { useGuestUser } from './GuestUserContext'

/**
 * UserStatsCard — v1.8.0 the small card that opens the user's matches: the user's name and four
 * badges (matches, completed, game over, play time) from GET /api/auth/me, re-read at every open.
 */
export default function UserStatsCard() {
  const { t } = useTranslation()
  const { user, refreshProfile } = useGuestUser() ?? {}
  const refresh = useRef(refreshProfile)
  refresh.current = refreshProfile

  // fresh statistics each time the book opens
  useEffect(() => { void refresh.current?.() }, [])

  const name = user?.displayName ?? user?.username ?? t('modals.guestUser.anonymous')
  return (
    <Card card={{ title: name, urlImage: null, awesomeIcon: 'fas fa-user' }}
      statistics={profileStatBadges(user?.stats, t)} flagShowFullStatistics bonusBadgeShowZeros hidePreview
      additionalCardClasses="user-stats-card" />
  )
}

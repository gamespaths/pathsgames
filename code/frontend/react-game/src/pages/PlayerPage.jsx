import { useEffect } from 'react'
import PlayerBook from '@/features/guest-user/PlayerBook'
import usePlayerPage from '@/features/guest-user/usePlayerPage'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import { useHomeButtonHandler } from '@/context/HomeButtonContext'

/**
 * PlayerPage — v1.13.0: route shell of `/player` (was the GuestUserModal overlay); the home tab runs
 * closePlayerPage and the preloaded matches are cleared on unmount.
 */
export default function PlayerPage() {
  const { closePlayerPage } = usePlayerPage()
  const { setMatches } = useGuestUser() ?? {}
  useHomeButtonHandler(closePlayerPage)
  useEffect(() => () => setMatches?.(null), [setMatches])
  return <PlayerBook />
}

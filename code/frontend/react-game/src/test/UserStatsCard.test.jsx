// v1.8.0 — the user's small card in the book: name, four statistics badges, refreshed at every open.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))
const tr = vi.hoisted(() => ({ 'profile.stats.playTimeMinutes': '{m} mins', 'profile.stats.playTimeHours': '{h} H',
  'profile.stats.playTimeDays': '{d} days' }))
vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => tr[k] ?? k, lang: 'en', setLang: vi.fn() }) }))
vi.mock('@/context/PolicyBookContext', () => ({ usePolicyBook: () => ({ openPolicyBook: vi.fn() }) }))

import UserStatsCard from '@/features/guest-user/UserStatsCard'

const STATS = { matchesPlayed: 4, matchesCompleted: 1, matchesGameOver: 2, playTimeMs: 5_400_000 }

function badges() {
  return [...document.querySelectorAll('.user-stats-card .bonus-badge')].map(b => b.textContent.trim())
}

describe('UserStatsCard', () => {
  it('titles the card with the display name and shows the four badges, refreshing /me once', () => {
    const refreshProfile = vi.fn()
    ctx.value = { user: { displayName: 'Mario Rossi', username: 'google_1', stats: STATS }, refreshProfile }
    const { rerender } = render(<UserStatsCard />)
    expect(screen.getByText('Mario Rossi')).toBeTruthy()
    expect(badges()).toEqual([
      'profile.stats.matchesPlayed:4',
      'profile.stats.matchesCompleted:1',
      'profile.stats.matchesGameOver:2',
      'profile.stats.playTime:1 H',
    ])
    expect(document.querySelector('.user-stats-card img')).toBeNull()
    rerender(<UserStatsCard />)
    expect(refreshProfile).toHaveBeenCalledTimes(1)
  })

  it('a guest is titled by the username and keeps the zero badges', () => {
    ctx.value = { user: { username: 'guest_x' } }
    render(<UserStatsCard />)
    expect(screen.getByText('guest_x')).toBeTruthy()
    expect(badges()).toEqual([
      'profile.stats.matchesPlayed:0',
      'profile.stats.matchesCompleted:0',
      'profile.stats.matchesGameOver:0',
      'profile.stats.playTime:0 mins',
    ])
  })

  it('without a context it reads as anonymous', () => {
    ctx.value = undefined
    render(<UserStatsCard />)
    expect(screen.getByText('modals.guestUser.anonymous')).toBeTruthy()
  })
})

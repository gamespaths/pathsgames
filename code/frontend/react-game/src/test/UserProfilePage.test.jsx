// v1.7.0 V1 step 7 — the profile page: guest and Google user, statistics, logout all, deletion, closing message.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))
const tr = vi.hoisted(() => ({ value: { 'profile.stats.playTimeValue': '{h} h {m} min' } }))
vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => tr.value[k] ?? k, lang: 'en', setLang: vi.fn() }) }))
vi.mock('@/context/PolicyBookContext', () => ({ usePolicyBook: () => ({ openPolicyBook: vi.fn() }) }))
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, extraContent, onClose }) => (
    <div>
      <h2 data-testid="page-title">{card.title}</h2>
      {onClose && <button onClick={onClose}>back</button>}
      {extraContent}
    </div>
  ),
}))
const gisMock = vi.hoisted(() => ({ load: vi.fn(), nonce: vi.fn(() => 'nonce-del') }))
vi.mock('@/auth/gisLoader', () => ({ loadGis: gisMock.load, newNonce: gisMock.nonce }))

import UserProfilePage, { profileErrorText, PolicyLinks } from '@/features/guest-user/UserProfilePage'

const STATS = { matchesPlayed: 4, matchesCompleted: 1, matchesGameOver: 2, playTimeMs: 5_400_000, clocksPlayed: 33 }

function base(extra = {}) {
  return {
    user: { accountType: 'GUEST', username: 'guest_x', stats: STATS, accessToken: 't' },
    isGoogleUser: false, googleEnabled: true, googleClientId: 'cid', refreshProfile: vi.fn(),
    profileError: null, clearProfileError: vi.fn(), accountDeleted: false, closeGuestModal: vi.fn(),
    logoutAll: vi.fn(), deleteAccount: vi.fn(), authBusy: false, profileBusy: false,
    supportedLanguages: ['en', 'it'], savePreferences: vi.fn(), loginWithGoogle: vi.fn(),
    ...extra,
  }
}

const GOOGLE_USER = { accountType: 'GOOGLE', displayName: 'Mario Rossi', nickname: 'mario', pictureUrl: 'p.png',
  stats: STATS, accessToken: 't' }

describe('UserProfilePage', () => {
  beforeEach(() => { gisMock.load.mockReset() })

  it('a guest: statistics, invitation, preferences, policy links; no logout all and no deletion', () => {
    ctx.value = base()
    const onClose = vi.fn()
    render(<UserProfilePage onClose={onClose} />)
    expect(ctx.value.refreshProfile).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('page-title')).toHaveTextContent('profile.title')
    expect(screen.getByText('guest_x')).toBeTruthy()
    expect(screen.getByText('profile.accountTypes.GUEST')).toBeTruthy()
    expect(screen.getByTestId('stat-matchesPlayed')).toHaveTextContent('4')
    expect(screen.getByTestId('stat-matchesGameOver')).toHaveTextContent('2')
    expect(screen.getByTestId('stat-playTime')).toHaveTextContent('1 h 30 min')
    expect(screen.getByTestId('stat-clocksPlayed')).toHaveTextContent('33')
    expect(screen.getByText('profile.guestInvite')).toBeTruthy()
    expect(screen.getByTestId('language-selector').querySelectorAll('button')).toHaveLength(2)
    expect(screen.queryByText('profile.logoutAll')).toBeNull()
    expect(screen.queryByText('profile.delete.button')).toBeNull()
    expect(screen.getByText('footer.privacy').getAttribute('href')).toBe('/privacy.html')
    fireEvent.click(screen.getByText('back'))
    expect(onClose).toHaveBeenCalled()
  })

  it('a guest without Google sign-in gets no invitation; no user reads as anonymous with zeros', () => {
    ctx.value = base({ googleEnabled: false, user: null, refreshProfile: undefined })
    render(<UserProfilePage onClose={vi.fn()} />)
    expect(screen.queryByText('profile.guestInvite')).toBeNull()
    expect(screen.getByText('modals.guestUser.anonymous')).toBeTruthy()
    expect(screen.getByTestId('stat-playTime')).toHaveTextContent('0 h 0 min')
  })

  it('a Google user: picture, name, nickname, account type and the account actions', () => {
    ctx.value = base({ isGoogleUser: true, user: GOOGLE_USER })
    render(<UserProfilePage onClose={vi.fn()} />)
    expect(document.querySelector('img.user-profile__avatar').getAttribute('src')).toBe('p.png')
    expect(screen.getByText('Mario Rossi')).toBeTruthy()
    expect(screen.getByText('mario')).toBeTruthy()
    expect(screen.getByText('profile.accountTypes.GOOGLE')).toBeTruthy()
    expect(screen.queryByText('profile.guestInvite')).toBeNull()
    expect(screen.getByText('profile.logoutAll')).toBeTruthy()
    expect(screen.getByText('profile.delete.button')).toBeTruthy()
  })

  it('v1.7.0 step 12 — the active sessions next to "Log out of all devices"', () => {
    tr.value['profile.activeSessions'] = 'Devices: {count}'
    ctx.value = base({ isGoogleUser: true, user: { ...GOOGLE_USER, activeSessions: 3 } })
    const { unmount } = render(<UserProfilePage onClose={vi.fn()} />)
    expect(screen.getByTestId('active-sessions')).toHaveTextContent('Devices: 3')
    unmount()
    ctx.value = base({ isGoogleUser: true, user: GOOGLE_USER })
    render(<UserProfilePage onClose={vi.fn()} />)
    expect(screen.queryByTestId('active-sessions')).toBeNull()
    delete tr.value['profile.activeSessions']
  })

  it('logout of all devices asks a confirmation, can be cancelled, then calls logoutAll', () => {
    ctx.value = base({ isGoogleUser: true, user: GOOGLE_USER })
    render(<UserProfilePage onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('profile.logoutAll'))
    expect(screen.getByTestId('confirm-logout-all')).toHaveTextContent('profile.logoutAllConfirm')
    fireEvent.click(screen.getByText('profile.cancel'))
    expect(screen.queryByTestId('confirm-logout-all')).toBeNull()
    fireEvent.click(screen.getByText('profile.logoutAll'))
    fireEvent.click(screen.getByText('profile.confirm'))
    expect(ctx.value.logoutAll).toHaveBeenCalledTimes(1)
  })

  it('deletion: what is deleted, a fresh Google popup whose credential deletes the account', async () => {
    let callback
    const gis = { initialize: vi.fn((cfg) => { callback = cfg.callback }), renderButton: vi.fn() }
    gisMock.load.mockResolvedValue(gis)
    ctx.value = base({ isGoogleUser: true, user: GOOGLE_USER })
    render(<UserProfilePage onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('profile.delete.button'))
    expect(screen.getByTestId('confirm-delete')).toHaveTextContent('profile.delete.what')
    await act(async () => { fireEvent.click(screen.getByText('profile.delete.confirmWithGoogle')) })
    await waitFor(() => expect(gis.renderButton).toHaveBeenCalled())
    expect(gis.initialize.mock.calls[0][0]).toMatchObject({ nonce: 'nonce-del', ux_mode: 'popup' })
    expect(gis.renderButton.mock.calls[0][1]).toMatchObject({ text: 'continue_with' })
    callback({ credential: 'fresh-cred' })
    expect(ctx.value.deleteAccount).toHaveBeenCalledWith('fresh-cred')
    expect(ctx.value.loginWithGoogle).not.toHaveBeenCalled()
  })

  it('deletion in progress: busy text and cancel disabled; cancel goes back', () => {
    ctx.value = base({ isGoogleUser: true, user: GOOGLE_USER, profileBusy: true })
    const { rerender } = render(<UserProfilePage onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('profile.delete.button'))
    expect(screen.getByText('profile.delete.deleting')).toBeTruthy()
    expect(screen.getByText('profile.cancel').disabled).toBe(true)
    ctx.value = base({ isGoogleUser: true, user: GOOGLE_USER })
    rerender(<UserProfilePage onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('profile.cancel'))
    expect(screen.getByText('profile.delete.button')).toBeTruthy()
  })

  it('after the deletion: the closing message, its button leaves the book', () => {
    ctx.value = base({ isGoogleUser: true, user: GOOGLE_USER, accountDeleted: true })
    render(<UserProfilePage onClose={vi.fn()} />)
    expect(screen.getByTestId('page-title')).toHaveTextContent('profile.delete.doneTitle')
    expect(screen.getByTestId('user-profile-deleted')).toHaveTextContent('profile.delete.done')
    fireEvent.click(screen.getByText('profile.delete.close'))
    expect(ctx.value.closeGuestModal).toHaveBeenCalled()
  })

  it('shows a profile error and clears it', () => {
    ctx.value = base({ isGoogleUser: true, user: GOOGLE_USER, profileError: 'FRESH_TOKEN_REQUIRED' })
    tr.value['profile.errors.FRESH_TOKEN_REQUIRED'] = 'too old'
    render(<UserProfilePage onClose={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('too old')
    fireEvent.click(screen.getByLabelText('modals.close'))
    expect(ctx.value.clearProfileError).toHaveBeenCalled()
    delete tr.value['profile.errors.FRESH_TOKEN_REQUIRED']
  })
})

describe('profileErrorText and PolicyLinks', () => {
  it('profile text first, then the auth text, then the generic one', () => {
    const texts = { 'profile.errors.A': 'pa', 'auth.errors.B': 'ab', 'profile.errors.generic': 'gen' }
    const t = (k) => texts[k] ?? k
    expect(profileErrorText(t, null)).toBeNull()
    expect(profileErrorText(t, 'A')).toBe('pa')
    expect(profileErrorText(t, 'B')).toBe('ab')
    expect(profileErrorText(t, 'C')).toBe('gen')
  })

  it('links the three static pages in a new tab', () => {
    render(<PolicyLinks />)
    for (const kind of ['privacy', 'terms', 'cookies']) {
      const link = screen.getByText(`footer.${kind}`)
      expect(link.getAttribute('href')).toBe(`/${kind}.html`)
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })
})

// v1.7.0 V1 step 11 — the user page: profile with email, match history, actions by state, error codes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import UserDetailPage from '../../pages/UserDetailPage'
import {
  getAdminUser, banUser, suspendUser, unblockUser, relinkSubject, deleteOldUser,
} from '../../api/userApi'
import { listMatches } from '../../api/matchApi'
import { suspendBounds } from '../../constants/userAdmin'

vi.mock('../../api/userApi', () => ({
  getAdminUser: vi.fn(), banUser: vi.fn(), suspendUser: vi.fn(), unblockUser: vi.fn(),
  relinkSubject: vi.fn(), deleteOldUser: vi.fn(),
}))
vi.mock('../../api/matchApi', () => ({ listMatches: vi.fn() }))

const UUID = 'aaaaaaaa-1111-4000-8000-000000000001'
const USER = {
  uuid: UUID, username: 'annabel', nickname: 'annabel', email: 'ann@example.com', role: 'PLAYER', state: 2,
  guest: false, tsRegistration: '2026-10-01T10:00:00Z', tsLastAccess: '2026-10-20T10:00:00Z', matchCount: 3,
  accountType: 'GOOGLE', suspendedUntil: null, relinkPending: false, banned: false, sessions: 2,
  stats: { matchesPlayed: 2, matchesCompleted: 1, matchesGameOver: 0, playTimeMs: 3_725_000, clocksPlayed: 14 },
  identities: [{ provider: 'GOOGLE', subject: 'sub-123', email: 'ann@example.com', profileName: 'Ann B',
    pictureUrl: 'https://img.example/p.png', locale: 'en', tsProfileUpdate: '2026-10-01T10:00:00Z' }],
}
const MATCHES = [
  { uuid: 'mmmmmmmm-0001', name: 'First run', status: 'BANNED', currentClock: 4, tsInsert: '2026-10-02T10:00:00Z', tsUpdate: '2026-10-03T10:00:00Z' },
  { uuid: 'mmmmmmmm-0002', name: '', status: 'CANCELLED', currentClock: 1, tsInsert: '2026-10-04T10:00:00Z' },
]

const renderPage = () => render(
  <MemoryRouter initialEntries={[`/users/${UUID}`]}>
    <Routes>
      <Route path="/users/:uuid" element={<UserDetailPage />} />
      <Route path="/users" element={<div data-testid="users-page">users</div>} />
      <Route path="/matches/:uuid" element={<div data-testid="match-page">match</div>} />
    </Routes>
  </MemoryRouter>
)

const fillReason = (code = 'CHEATING', text = 'used an auto-clicker bot') => {
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: code } })
  fireEvent.change(screen.getByLabelText('Details'), { target: { value: text } })
}
const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
const refused = (code, message = 'refused') => Object.assign(new Error(message), { code })

describe('UserDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAdminUser.mockResolvedValue(USER)
    listMatches.mockResolvedValue({ items: MATCHES, nextCursor: null, limit: 20 })
  })

  it('shows the profile with the email, identities, stats and the match history', async () => {
    renderPage()
    expect(await screen.findByTestId('user-profile')).toHaveTextContent('ann@example.com')
    expect(getAdminUser).toHaveBeenCalledWith(UUID)
    expect(screen.getByTestId('user-profile')).toHaveTextContent('Open sessions2')
    expect(screen.getByTestId('user-identities')).toHaveTextContent('sub-123')
    expect(screen.getByTestId('user-identities')).toHaveTextContent('Ann B')
    expect(screen.getByRole('link', { name: 'open' })).toHaveAttribute('href', 'https://img.example/p.png')
    expect(screen.getByTestId('user-stats')).toHaveTextContent('Play time1h 02m')
    expect(screen.getByTestId('user-stats')).toHaveTextContent('Clocks played14')
    await waitFor(() => expect(listMatches).toHaveBeenCalledWith({ userUuid: UUID, limit: 20 }))
    const table = await screen.findByTestId('user-matches')
    expect(within(table).getByText('BANNED')).toBeInTheDocument()
    expect(within(table).getByText('CANCELLED')).toBeInTheDocument()
    expect(within(table).getByText('untitled')).toBeInTheDocument()
    expect(screen.getByText(/all loaded/)).toBeInTheDocument()
  })

  it('opens a match page and goes back to the list', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Open match First run' }))
    expect(await screen.findByTestId('match-page')).toBeInTheDocument()
  })

  it('goes back to the users list', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Users/ }))
    expect(await screen.findByTestId('users-page')).toBeInTheDocument()
  })

  it('pages the match history with the cursor', async () => {
    listMatches
      .mockResolvedValueOnce({ items: [MATCHES[0]], nextCursor: 'mc1' })
      .mockResolvedValueOnce({ items: [MATCHES[1]], nextCursor: null })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Load more/ }))
    expect(await screen.findByText('CANCELLED')).toBeInTheDocument()
    expect(listMatches).toHaveBeenLastCalledWith({ userUuid: UUID, limit: 20, cursor: 'mc1' })
    expect(screen.getByText('First run')).toBeInTheDocument()
  })

  it('shows the match history error and an empty history', async () => {
    listMatches.mockRejectedValueOnce(new Error('Matches down'))
    renderPage()
    expect(await screen.findByText('Matches down')).toBeInTheDocument()
    listMatches.mockResolvedValueOnce({})
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }))
    expect(await screen.findByText('No matches.')).toBeInTheDocument()
  })

  it('shows the error of an unknown user', async () => {
    getAdminUser.mockRejectedValue(refused('USER_NOT_FOUND', 'No user'))
    renderPage()
    expect(await screen.findByText(/No user has this uuid. \(USER_NOT_FOUND\)/)).toBeInTheDocument()
    expect(screen.queryByTestId('user-profile')).not.toBeInTheDocument()
  })

  it('bans an active user with a reason and refreshes the page', async () => {
    banUser.mockResolvedValue({ uuid: UUID, action: 'BAN', state: 4, bannedMatchUuids: ['m1', 'm2'] })
    renderPage()
    await screen.findByTestId('user-profile')
    fireEvent.click(screen.getByRole('button', { name: /^Ban$/ }))
    expect(screen.getByRole('dialog', { name: 'Ban user' })).toHaveTextContent('annabel: Every session is revoked')
    fillReason()
    getAdminUser.mockResolvedValue({ ...USER, state: 4, banned: true })
    confirm()
    await waitFor(() => expect(banUser).toHaveBeenCalledWith(UUID, 'Cheating: used an auto-clicker bot'))
    expect(await screen.findByText('User banned, 2 active match(es) set to BANNED.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Unblock/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Ban$/ })).not.toBeInTheDocument()
    expect(screen.getByText('Banned')).toBeInTheDocument()
    expect(getAdminUser).toHaveBeenCalledTimes(2)
  })

  it('a ban without active matches says so plainly', async () => {
    banUser.mockResolvedValue({ uuid: UUID, action: 'BAN', state: 4 })
    renderPage()
    await screen.findByTestId('user-profile')
    fireEvent.click(screen.getByRole('button', { name: /^Ban$/ }))
    fillReason()
    confirm()
    expect(await screen.findByText('User banned.')).toBeInTheDocument()
  })

  it('suspends with the until date', async () => {
    suspendUser.mockResolvedValue({ uuid: UUID, action: 'SUSPEND', state: 3, suspendedUntil: '2026-11-01T00:00:00Z' })
    renderPage()
    await screen.findByTestId('user-profile')
    fireEvent.click(screen.getByRole('button', { name: /Suspend/ }))
    fillReason('ABUSE', 'rude words in the chat')
    const { min } = suspendBounds()
    fireEvent.change(screen.getByLabelText(/Suspended until/), { target: { value: min } })
    confirm()
    await waitFor(() => expect(suspendUser).toHaveBeenCalledWith(UUID, min, 'Abuse: rude words in the chat'))
    expect(await screen.findByText(/User suspended until/)).toBeInTheDocument()
  })

  it('keeps the dialog open with the SUSPEND_UNTIL_INVALID error', async () => {
    suspendUser.mockRejectedValue(refused('SUSPEND_UNTIL_INVALID'))
    renderPage()
    await screen.findByTestId('user-profile')
    fireEvent.click(screen.getByRole('button', { name: /Suspend/ }))
    fillReason()
    fireEvent.change(screen.getByLabelText(/Suspended until/), { target: { value: suspendBounds().max } })
    confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('(SUSPEND_UNTIL_INVALID)')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(getAdminUser).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reloads the user on INVALID_STATE_TRANSITION', async () => {
    banUser.mockRejectedValue(refused('INVALID_STATE_TRANSITION'))
    renderPage()
    await screen.findByTestId('user-profile')
    fireEvent.click(screen.getByRole('button', { name: /^Ban$/ }))
    fillReason()
    confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('(INVALID_STATE_TRANSITION)')
    await waitFor(() => expect(getAdminUser).toHaveBeenCalledTimes(2))
  })

  it('shows the GUEST_NOT_BANNABLE and ADMIN_NOT_BANNABLE codes', async () => {
    banUser.mockRejectedValueOnce(refused('GUEST_NOT_BANNABLE')).mockRejectedValueOnce(refused('ADMIN_NOT_BANNABLE'))
    renderPage()
    await screen.findByTestId('user-profile')
    fireEvent.click(screen.getByRole('button', { name: /^Ban$/ }))
    fillReason()
    confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('(GUEST_NOT_BANNABLE)')
    confirm()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('(ADMIN_NOT_BANNABLE)'))
  })

  it('unblocks a suspended user and shows the suspension end', async () => {
    getAdminUser.mockResolvedValue({ ...USER, state: 3, suspendedUntil: '2026-11-01T00:00:00Z' })
    unblockUser.mockResolvedValue({ uuid: UUID, action: 'UNBLOCK', state: 2 })
    renderPage()
    await screen.findByTestId('user-profile')
    expect(screen.getByTestId('user-profile')).toHaveTextContent(/Suspendeduntil/)
    fireEvent.click(screen.getByRole('button', { name: /Unblock/ }))
    fillReason('OTHER', 'appeal accepted by support')
    confirm()
    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith(UUID, 'Other: appeal accepted by support'))
    expect(await screen.findByText('User unblocked.')).toBeInTheDocument()
  })

  it('arms the re-link and deletes the old user from the IDENTITY_MISMATCH panel', async () => {
    relinkSubject.mockResolvedValue({ uuid: UUID, action: 'RELINK_SUBJECT', relinkPending: true })
    deleteOldUser.mockResolvedValue({ uuid: UUID, action: 'DELETE_OLD_USER', state: 7 })
    renderPage()
    await screen.findByTestId('mismatch-panel')
    fireEvent.click(screen.getByRole('button', { name: /Arm re-link/ }))
    fillReason('SUPPORT_REQUEST', 'new Google account, same email')
    getAdminUser.mockResolvedValue({ ...USER, relinkPending: true })
    confirm()
    await waitFor(() => expect(relinkSubject).toHaveBeenCalledWith(UUID, 'Support request: new Google account, same email'))
    expect(await screen.findByText(/Re-link armed:/)).toBeInTheDocument()
    expect(await within(screen.getByTestId('mismatch-panel')).findByText('Re-link armed')).toBeInTheDocument()
    expect(screen.getByTestId('user-profile')).toHaveTextContent('Re-link armedyes')
    expect(screen.getByRole('button', { name: /Arm re-link/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Delete the old user/ }))
    fillReason('OTHER', 'old user of a mismatch')
    confirm()
    await waitFor(() => expect(deleteOldUser).toHaveBeenCalledWith(UUID, 'Other: old user of a mismatch'))
    expect(await screen.findByText(/User marked for deletion/)).toBeInTheDocument()
  })

  it('an ADMIN gets no ban, suspend or deletion', async () => {
    getAdminUser.mockResolvedValue({ ...USER, role: 'ADMIN' })
    renderPage()
    await screen.findByTestId('user-actions')
    expect(screen.getByText(/An ADMIN can never be banned/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Ban$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Suspend/ })).not.toBeInTheDocument()
    expect(screen.getByText('No action for this state.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete the old user/ })).toBeDisabled()
  })

  it('a guest gets no action and a sparse profile', async () => {
    getAdminUser.mockResolvedValue({ uuid: UUID, guest: true, state: 6, identities: [], stats: null })
    listMatches.mockResolvedValue({ items: [], nextCursor: null })
    renderPage()
    await screen.findByTestId('user-actions')
    expect(screen.getByText(/A guest: use the Guest Users page/)).toBeInTheDocument()
    expect(screen.getByText('No login identity.')).toBeInTheDocument()
    expect(screen.getByTestId('user-profile')).toHaveTextContent('AccountGUEST')
    expect(screen.getByRole('heading', { name: UUID })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Arm re-link/ })).toBeDisabled()
  })

  it('renders identities without names or picture and a user without account type', async () => {
    getAdminUser.mockResolvedValue({ ...USER, accountType: undefined, nickname: '', username: '', sessions: undefined,
      matchCount: undefined, stats: undefined,
      identities: [{ provider: 'GOOGLE', subject: 's2', givenName: 'Ann', familyName: 'Bee' }, { provider: 'X', subject: 's3' }] })
    renderPage()
    const ids = await screen.findByTestId('user-identities')
    expect(ids).toHaveTextContent('Ann Bee')
    expect(screen.getByTestId('user-profile')).toHaveTextContent('Account—')
    expect(screen.getByTestId('user-stats')).toHaveTextContent('Matches played0')
  })
})

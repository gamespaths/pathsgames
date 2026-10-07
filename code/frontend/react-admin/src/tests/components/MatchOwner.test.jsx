// v0.41.6 — the User tab: UserCard (owner fields, expired badge, Move disabled on a terminal match) and
// MoveOwnerModal (find, preview, refusals, confirm), plus the tab on MatchDetailPage after Snapshots.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../api/matchApi', () => ({
  getMatchInfo: vi.fn(),
  getMatchClock: vi.fn(),
  getMatchWeather: vi.fn(),
  getMatchLocations: vi.fn(),
  getMatchLogs: vi.fn(),
  stopMatch: vi.fn(),
  pauseMatch: vi.fn(),
  resumeMatch: vi.fn(),
  deleteMatch: vi.fn(),
  getMatchOwner: vi.fn(),
  moveMatchOwner: vi.fn(),
  errorBody: (e) => e?.response?.data ?? {},
}))
vi.mock('../../api/userApi', () => ({ getAdminUser: vi.fn() }))
vi.mock('../../api/storyApi', () => ({ getStory: vi.fn(), listEntities: vi.fn() }))

import * as matchApi from '../../api/matchApi'
import { getAdminUser } from '../../api/userApi'
import { getStory, listEntities } from '../../api/storyApi'
import UserCard, { UserFields, reasonText } from '../../components/match/detail/UserCard'
import MoveOwnerModal from '../../components/match/detail/MoveOwnerModal'
import MatchDetailPage from '../../pages/MatchDetailPage'

const OWNER = {
  uuid: 'aaaaaaaa-0000-4000-8000-000000000001', username: 'alice', nickname: 'Alice', email: 'a@x.it',
  role: 'PLAYER', state: 6, guest: true, guestExpiresAt: '2000-01-01T00:00:00Z', expired: true,
  tsRegistration: '2026-01-01T00:00:00Z', tsLastAccess: '2026-02-01T00:00:00Z', matchCount: 2,
  eligible: false, reason: 'USER_EXPIRED',
}
const BOB = {
  uuid: 'bbbbbbbb-0000-4000-8000-000000000002', username: 'bob', role: 'PLAYER', state: 6, guest: true,
  guestExpiresAt: null, expired: false, matchCount: 0, eligible: true, reason: null,
}
const error = (status, code, message) => ({ response: { status, data: { error: code, message } } })

describe('UserFields', () => {
  it('shows "no expiry / no cookie" for an imported guest and dashes for a player', () => {
    const { unmount } = render(<UserFields user={BOB} />)
    expect(screen.getByText('no expiry / no cookie')).toBeInTheDocument()
    expect(screen.queryByText('expired')).not.toBeInTheDocument()
    unmount()
    render(<UserFields user={{ uuid: null, guest: false }} />)
    expect(screen.getByText('no')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(4)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(reasonText('OTHER')).toBe('OTHER')
  })
})

describe('UserCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchApi.getMatchOwner.mockResolvedValue(OWNER)
  })

  it('loads the owner with the expired badge and the refusal reason', async () => {
    render(<UserCard matchUuid="m1" notice="Match moved from x to y." />)
    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(screen.getByText('expired')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/Expired guest/)).toBeInTheDocument()
    expect(screen.getByTestId('owner-notice')).toHaveTextContent('Match moved from x to y.')
    expect(screen.getByLabelText('Move match')).toBeEnabled()
    expect(matchApi.getMatchOwner).toHaveBeenCalledWith('m1')
  })

  it('disables Move on a terminated match and shows a load failure', async () => {
    const { unmount } = render(<UserCard matchUuid="m1" terminal />)
    await screen.findByText('alice')
    expect(screen.getByLabelText('Move match')).toBeDisabled()
    expect(screen.getByLabelText('Move match')).toHaveAttribute('title', 'A terminated match cannot be moved')
    unmount()
    matchApi.getMatchOwner.mockRejectedValueOnce(error(404, 'USER_NOT_FOUND', 'The owner of the match no longer exists'))
    const second = render(<UserCard matchUuid="m1" />)
    expect(await screen.findByText('The owner of the match no longer exists')).toBeInTheDocument()
    expect(screen.getByLabelText('Move match')).toBeDisabled()
    second.unmount()
    matchApi.getMatchOwner.mockRejectedValueOnce(new Error('network'))
    const third = render(<UserCard matchUuid="m1" />)
    expect(await screen.findByText('network')).toBeInTheDocument()
    third.unmount()
    matchApi.getMatchOwner.mockRejectedValueOnce({})
    render(<UserCard matchUuid="m1" />)
    expect(await screen.findByText('Failed to load the owner')).toBeInTheDocument()
  })

  it('moves the match: find, preview, confirm, reload with the notice', async () => {
    getAdminUser.mockResolvedValue(BOB)
    matchApi.moveMatchOwner.mockResolvedValue({ status: 'MOVED', previousOwner: { username: 'alice' },
      owner: { username: 'bob' }, charactersMoved: 1 })
    const onMoved = vi.fn()
    render(<UserCard matchUuid="m1" status="RUNNING" onMoved={onMoved} />)
    await userEvent.click(await screen.findByLabelText('Move match'))
    expect(screen.getByTestId('running-warning')).toHaveTextContent('pause the match first')
    await userEvent.type(screen.getByLabelText('User identifier'), ' bob ')
    await userEvent.click(screen.getByText('Find'))
    expect(await screen.findByTestId('move-preview')).toHaveTextContent('bob')
    expect(getAdminUser).toHaveBeenCalledWith(' bob ')
    await userEvent.click(screen.getByText('Confirm'))
    await waitFor(() => expect(onMoved).toHaveBeenCalledWith('Match moved from alice to bob.'))
    expect(matchApi.moveMatchOwner).toHaveBeenCalledWith('m1', 'bob')
    expect(screen.queryByTestId('move-owner-modal')).not.toBeInTheDocument()
    expect(matchApi.getMatchOwner).toHaveBeenCalledTimes(2)
  })

  it('reports UNCHANGED and works without onMoved; Cancel closes the modal', async () => {
    getAdminUser.mockResolvedValue(OWNER)
    matchApi.moveMatchOwner.mockResolvedValue({ status: 'UNCHANGED', owner: { username: 'alice' } })
    render(<UserCard matchUuid="m1" status="PAUSED" />)
    await userEvent.click(await screen.findByLabelText('Move match'))
    expect(screen.queryByTestId('running-warning')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByTestId('move-owner-modal')).not.toBeInTheDocument()
  })
})

describe('UserCard move messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchApi.getMatchOwner.mockResolvedValue(OWNER)
    getAdminUser.mockResolvedValue(BOB)
  })

  async function moveWith(result) {
    matchApi.moveMatchOwner.mockResolvedValueOnce(result)
    const onMoved = vi.fn()
    const view = render(<UserCard matchUuid="m1" onMoved={onMoved} />)
    await userEvent.click(await screen.findByLabelText('Move match'))
    await userEvent.type(screen.getByLabelText('User identifier'), 'bob')
    await userEvent.click(screen.getByText('Find'))
    await userEvent.click(await screen.findByText('Confirm'))
    await waitFor(() => expect(onMoved).toHaveBeenCalled())
    view.unmount()
    return onMoved.mock.calls[0][0]
  }

  it('words UNCHANGED and a bare answer', async () => {
    expect(await moveWith({ status: 'UNCHANGED', owner: { username: 'bob' } })).toBe('bob already owns this match.')
    expect(await moveWith({ status: 'UNCHANGED' })).toBe('The user already owns this match.')
    expect(await moveWith(null)).toBe('Match moved from — to —.')
  })

  it('reloads the owner even without onMoved', async () => {
    matchApi.moveMatchOwner.mockResolvedValueOnce({ status: 'MOVED' })
    render(<UserCard matchUuid="m1" />)
    await userEvent.click(await screen.findByLabelText('Move match'))
    await userEvent.type(screen.getByLabelText('User identifier'), 'bob')
    await userEvent.click(screen.getByText('Find'))
    await userEvent.click(await screen.findByText('Confirm'))
    await waitFor(() => expect(matchApi.getMatchOwner).toHaveBeenCalledTimes(2))
  })
})

describe('MoveOwnerModal', () => {
  const owner = { uuid: BOB.uuid }

  beforeEach(() => { vi.clearAllMocks() })

  async function find(text) {
    await userEvent.type(screen.getByLabelText('User identifier'), text)
    await userEvent.click(screen.getByText('Find'))
  }

  it('keeps Confirm off until an eligible preview, and shows the reason of a refused one', async () => {
    getAdminUser.mockResolvedValueOnce({ ...OWNER, eligible: false, reason: 'USER_NOT_ALLOWED' })
    render(<MoveOwnerModal matchUuid="m1" owner={owner} onMoved={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Find')).toBeDisabled()
    expect(screen.getByText('Confirm')).toBeDisabled()
    await find('test_admin')
    expect(await screen.findByText(/Not allowed/)).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeDisabled()
  })

  it('says when the user already owns the match, and clears the preview on a new identifier', async () => {
    getAdminUser.mockResolvedValueOnce(BOB)
    render(<MoveOwnerModal matchUuid="m1" owner={owner} onMoved={vi.fn()} onCancel={vi.fn()} />)
    await find('bob')
    expect(await screen.findByText('This user already owns the match.')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeEnabled()
    await userEvent.type(screen.getByLabelText('User identifier'), 'x')
    expect(screen.queryByTestId('move-preview')).not.toBeInTheDocument()
  })

  it('shows the 404 / 409 codes of the preview and of the move', async () => {
    getAdminUser.mockRejectedValueOnce(error(404, 'USER_NOT_FOUND', 'No user matches: ghost'))
    const onMoved = vi.fn()
    render(<MoveOwnerModal matchUuid="m1" owner={owner} onMoved={onMoved} onCancel={vi.fn()} />)
    await find('ghost')
    expect(await screen.findByTestId('move-error')).toHaveTextContent('USER_NOT_FOUND: No user matches: ghost')
    getAdminUser.mockResolvedValueOnce({ ...BOB, uuid: 'other' })
    matchApi.moveMatchOwner.mockRejectedValueOnce(error(409, 'ACTIVE_MATCH_ALREADY_EXISTS', 'busy'))
    await userEvent.click(screen.getByText('Find'))
    await userEvent.click(await screen.findByText('Confirm'))
    expect(await screen.findByTestId('move-error')).toHaveTextContent('ACTIVE_MATCH_ALREADY_EXISTS: busy')
    expect(onMoved).not.toHaveBeenCalled()
    expect(screen.getByText('Confirm')).toBeEnabled()
  })

  it('falls back to plain messages, submits with Enter and closes on the backdrop', async () => {
    getAdminUser.mockRejectedValueOnce(new Error('offline'))
    const onCancel = vi.fn()
    const { container } = render(<MoveOwnerModal matchUuid="m1" onMoved={vi.fn()} onCancel={onCancel} />)
    await userEvent.type(screen.getByLabelText('User identifier'), 'x{Enter}')
    expect(await screen.findByTestId('move-error')).toHaveTextContent('offline')
    getAdminUser.mockRejectedValueOnce({})
    await userEvent.click(screen.getByText('Find'))
    expect(await screen.findByTestId('move-error')).toHaveTextContent('User not found')
    getAdminUser.mockResolvedValueOnce(BOB)
    matchApi.moveMatchOwner.mockRejectedValueOnce({ response: { data: { message: 'only text' } } })
    await userEvent.click(screen.getByText('Find'))
    await userEvent.click(await screen.findByText('Confirm'))
    expect(await screen.findByTestId('move-error')).toHaveTextContent('only text')
    getAdminUser.mockResolvedValueOnce(BOB)
    matchApi.moveMatchOwner.mockRejectedValueOnce({})
    await userEvent.click(screen.getByText('Find'))
    await userEvent.click(await screen.findByText('Confirm'))
    expect(await screen.findByTestId('move-error')).toHaveTextContent('The move failed')
    await userEvent.click(within(screen.getByTestId('move-owner-modal')).getByLabelText('User identifier'))
    expect(onCancel).not.toHaveBeenCalled()
    await userEvent.click(container.querySelector('.pg-modal-backdrop'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('an Enter on an empty identifier does nothing', async () => {
    render(<MoveOwnerModal matchUuid="m1" onMoved={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('User identifier'), '  {Enter}')
    expect(getAdminUser).not.toHaveBeenCalled()
  })
})

describe('MatchDetailPage User tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchApi.getMatchInfo.mockResolvedValue({ match: { uuid: 'm1', status: 'ENDED' }, locations: [], registry: [], players: [] })
    matchApi.getMatchClock.mockRejectedValue(new Error('x'))
    matchApi.getMatchWeather.mockRejectedValue(new Error('x'))
    matchApi.getMatchLocations.mockRejectedValue(new Error('x'))
    matchApi.getMatchLogs.mockResolvedValue({})
    matchApi.getMatchOwner.mockResolvedValue(OWNER)
    getStory.mockResolvedValue({})
    listEntities.mockResolvedValue([])
  })

  it('puts the User tab after Snapshots and opens the owner card, Move disabled on an ENDED match', async () => {
    render(
      <MemoryRouter initialEntries={['/matches/m1']}>
        <Routes><Route path="/matches/:uuid" element={<MatchDetailPage />} /></Routes>
      </MemoryRouter>
    )
    const tabs = (await screen.findAllByRole('tab')).map(t => t.textContent.trim())
    expect(tabs.indexOf('User')).toBe(tabs.indexOf('Snapshots') + 1)
    await userEvent.click(screen.getByRole('tab', { name: /User/i }))
    expect(await screen.findByTestId('user-panel')).toHaveTextContent('alice')
    expect(screen.getByLabelText('Move match')).toBeDisabled()
  })

  it('reloads the match and keeps the notice after a move', async () => {
    matchApi.getMatchInfo.mockResolvedValue({ match: { uuid: 'm1', status: 'RUNNING' }, locations: [], registry: [], players: [] })
    getAdminUser.mockResolvedValue(BOB)
    matchApi.moveMatchOwner.mockResolvedValue({ status: 'MOVED', previousOwner: { username: 'alice' }, owner: { username: 'bob' } })
    render(
      <MemoryRouter initialEntries={['/matches/m1']}>
        <Routes><Route path="/matches/:uuid" element={<MatchDetailPage />} /></Routes>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByRole('tab', { name: /User/i }))
    await userEvent.click(await screen.findByLabelText('Move match'))
    await userEvent.type(screen.getByLabelText('User identifier'), 'bob')
    await userEvent.click(screen.getByText('Find'))
    await userEvent.click(await screen.findByText('Confirm'))
    expect(await screen.findByTestId('owner-notice')).toHaveTextContent('Match moved from alice to bob.')
    expect(matchApi.getMatchInfo).toHaveBeenCalledTimes(2)
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GuestUserProvider, useGuestUser } from '@/features/guest-user/GuestUserContext'
import * as authApi from '../api/auth'

vi.mock('../context/ServerContext', () => {
  let current = 'http://api.test'
  return {
    useServer: () => ({ server: current }),
    __setServer: (url) => { current = url },
  }
})

async function setServer(url) {
  const { __setServer } = await import('../context/ServerContext')
  __setServer(url)
}

function Probe() {
  const { user, loading, error, refreshGuest, clearGuest,
          guestModalOpen, openGuestModal, closeGuestModal, matches } = useGuestUser()
  return (
    <div>
      <span data-testid="username">{user?.username ?? 'none'}</span>
      <span data-testid="uuid">{user?.userUuid ?? ''}</span>
      <span data-testid="token">{user?.accessToken ?? 'no-token'}</span>
      <span data-testid="loading">{loading ? 'yes' : 'no'}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="modal">{guestModalOpen ? 'open' : 'closed'}</span>
      <span data-testid="matches">{matches ? matches.length : 'null'}</span>
      <button onClick={() => refreshGuest()}>refresh</button>
      <button onClick={() => clearGuest()}>clear</button>
      <button onClick={() => openGuestModal([{ uuid: 'm1' }])}>open-pre</button>
      <button onClick={() => openGuestModal()}>open-empty</button>
      <button onClick={() => closeGuestModal()}>close</button>
    </div>
  )
}

describe('GuestUserContext', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await setServer('http://api.test')
    // Default happy-path so mounting populates a guest unless a test overrides.
    vi.spyOn(authApi, 'resumeGuestSession').mockResolvedValue({
      userUuid: 'resumed-uuid', username: 'guest_resumed',
    })
    vi.spyOn(authApi, 'createGuestSession').mockResolvedValue({
      userUuid: 'new-uuid', username: 'guest_new', accessToken: 'jwt-tok',
    })
  })

  it('uses resumeGuestSession when the backend still has a session', async () => {
    const createSpy = vi.spyOn(authApi, 'createGuestSession')

    render(<GuestUserProvider><Probe /></GuestUserProvider>)

    await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('guest_resumed'))
    expect(createSpy).not.toHaveBeenCalled()
    // resume payload has no accessToken → toIdentity falls back to null
    expect(screen.getByTestId('token').textContent).toBe('no-token')
  })

  it('falls back to createGuestSession when resume fails', async () => {
    vi.spyOn(authApi, 'resumeGuestSession').mockRejectedValue(new Error('401'))

    render(<GuestUserProvider><Probe /></GuestUserProvider>)

    await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('guest_new'))
    expect(screen.getByTestId('token').textContent).toBe('jwt-tok')
  })

  it('sets an error when both resume and create fail on mount', async () => {
    vi.spyOn(authApi, 'resumeGuestSession').mockRejectedValue(new Error('401'))
    vi.spyOn(authApi, 'createGuestSession').mockRejectedValue(new Error('backend-down'))

    render(<GuestUserProvider><Probe /></GuestUserProvider>)

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('backend-down'))
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('no'))
  })

  it('refreshGuest creates a guest via the API on a real server', async () => {
    const createSpy = vi.spyOn(authApi, 'createGuestSession')
      .mockResolvedValue({ userUuid: 'c', username: 'guest_c', accessToken: 'tok' })

    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('guest_resumed'))

    fireEvent.click(screen.getByText('refresh'))
    await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('guest_c'))
    expect(createSpy).toHaveBeenCalled()
  })

  it('refreshGuest records an error when create fails on a real server', async () => {
    vi.spyOn(authApi, 'createGuestSession').mockRejectedValue(new Error('refresh-boom'))

    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('guest_resumed'))

    fireEvent.click(screen.getByText('refresh'))
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('refresh-boom'))
  })

  it('clearGuest resets the user to none', async () => {
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('guest_resumed'))
    fireEvent.click(screen.getByText('clear'))
    expect(screen.getByTestId('username').textContent).toBe('none')
  })

  it('openGuestModal stores preloaded matches; closeGuestModal clears them', async () => {
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    fireEvent.click(screen.getByText('open-pre'))
    expect(screen.getByTestId('modal').textContent).toBe('open')
    expect(screen.getByTestId('matches').textContent).toBe('1')

    fireEvent.click(screen.getByText('close'))
    expect(screen.getByTestId('modal').textContent).toBe('closed')
    expect(screen.getByTestId('matches').textContent).toBe('null')
  })

  it('openGuestModal with no argument leaves matches null', async () => {
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    fireEvent.click(screen.getByText('open-empty'))
    expect(screen.getByTestId('modal').textContent).toBe('open')
    expect(screen.getByTestId('matches').textContent).toBe('null')
  })
})

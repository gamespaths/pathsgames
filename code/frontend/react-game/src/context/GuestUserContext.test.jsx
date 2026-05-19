import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { GuestUserProvider, useGuestUser } from './GuestUserContext'
import * as authApi from '../api/auth'

vi.mock('./ServerContext', () => {
  let current = 'mock'
  return {
    MOCK_SERVER: 'mock',
    useServer: () => ({ server: current }),
    __setServer: (url) => { current = url },
  }
})

function Probe() {
  const { user, loading } = useGuestUser()
  return (
    <div>
      <span data-testid="username">{user?.username ?? 'none'}</span>
      <span data-testid="uuid">{user?.userUuid ?? ''}</span>
      <span data-testid="loading">{loading ? 'yes' : 'no'}</span>
    </div>
  )
}

describe('GuestUserContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('synthesizes a mock guest when server is mock without calling the API', async () => {
    const createSpy = vi.spyOn(authApi, 'createGuestSession')
    const resumeSpy = vi.spyOn(authApi, 'resumeGuestSession')

    render(<GuestUserProvider><Probe /></GuestUserProvider>)

    await waitFor(() => expect(screen.getByTestId('username').textContent).toMatch(/^guest_/))
    expect(createSpy).not.toHaveBeenCalled()
    expect(resumeSpy).not.toHaveBeenCalled()
  })

  it('uses resumeGuestSession when the backend still has a session', async () => {
    const { __setServer } = await import('./ServerContext')
    __setServer('http://api.test')
    vi.spyOn(authApi, 'resumeGuestSession').mockResolvedValue({
      userUuid: 'resumed-uuid', username: 'guest_resumed',
    })
    const createSpy = vi.spyOn(authApi, 'createGuestSession')

    render(<GuestUserProvider><Probe /></GuestUserProvider>)

    await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('guest_resumed'))
    expect(createSpy).not.toHaveBeenCalled()
    __setServer('mock')
  })

  it('falls back to createGuestSession when resume fails', async () => {
    const { __setServer } = await import('./ServerContext')
    __setServer('http://api.test')
    vi.spyOn(authApi, 'resumeGuestSession').mockRejectedValue(new Error('401'))
    vi.spyOn(authApi, 'createGuestSession').mockResolvedValue({
      userUuid: 'new-uuid', username: 'guest_new',
    })

    render(<GuestUserProvider><Probe /></GuestUserProvider>)

    await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('guest_new'))
    __setServer('mock')
  })
})

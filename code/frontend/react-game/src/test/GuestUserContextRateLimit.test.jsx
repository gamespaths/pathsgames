import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GuestUserProvider, useGuestUser } from '@/features/guest-user/GuestUserContext'
import * as authApi from '../api/auth'

// v0.41.0 — a guest login refused with 429 keeps the RATE_LIMITED code and the wait for the navbar.
vi.mock('../context/ServerContext', () => ({ useServer: () => ({ server: 'http://api.test' }) }))

function Probe() {
  const { user, error, errorRetryAfter, refreshGuest } = useGuestUser()
  return (
    <div>
      <span data-testid="username">{user?.username ?? 'none'}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="retry">{String(errorRetryAfter)}</span>
      <button onClick={() => refreshGuest()}>refresh</button>
    </div>
  )
}

const limited = (seconds) => ({
  response: { status: 429, data: { error: 'RATE_LIMITED', message: 'Too many guest sessions from this address', retryAfterSeconds: seconds } },
})

describe('GuestUserContext — rate limit (v0.41.0)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(authApi, 'resumeGuestSession').mockRejectedValue(new Error('no cookie'))
  })

  it('stores RATE_LIMITED and the wait when the guest creation answers 429', async () => {
    vi.spyOn(authApi, 'createGuestSession').mockRejectedValue(limited(1800))
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('RATE_LIMITED'))
    expect(screen.getByTestId('retry')).toHaveTextContent('1800')
    expect(screen.getByTestId('username')).toHaveTextContent('none')
  })

  it('a refresh refused with 429 reports it and keeps the current guest', async () => {
    vi.spyOn(authApi, 'createGuestSession').mockResolvedValue({ userUuid: 'u1', username: 'guest_1', accessToken: 't' })
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('username')).toHaveTextContent('guest_1'))
    expect(screen.getByTestId('retry')).toHaveTextContent('0')

    vi.spyOn(authApi, 'createGuestSession').mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '90' } } })
    fireEvent.click(screen.getByText('refresh'))
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('RATE_LIMITED'))
    expect(screen.getByTestId('retry')).toHaveTextContent('90')
    expect(screen.getByTestId('username')).toHaveTextContent('guest_1')
  })

  it('any other failure keeps its message and no wait', async () => {
    vi.spyOn(authApi, 'createGuestSession').mockRejectedValue(new Error('backend-down'))
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('backend-down'))
    expect(screen.getByTestId('retry')).toHaveTextContent('0')
  })
})

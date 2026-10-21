import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// v1.2.0 — the login card of the start-match book: "Logged" for a Google user, a Login
// button to the user book for a guest while Google sign-in is on.

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }) }))
const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))
vi.mock('@/api/matches', () => ({ createMatch: vi.fn(), joinMatch: vi.fn(), startMatch: vi.fn() }))
vi.mock('@/context/PolicyBookContext', () => ({
  usePolicyBook: () => ({ policyBook: null, openPolicyBook: vi.fn(), closePolicyBook: vi.fn() }),
}))
vi.mock('@/hooks/useAntibot', () => ({ default: () => ({ phase: 'ready', token: 'tok-cf', retry: vi.fn() }) }))
vi.mock('@/components/book/Book', () => ({ default: ({ left, right }) => <div>{left}{right}</div> }))
vi.mock('@/components/modals/CardPreviewModal', () => ({ default: () => null }))
vi.mock('@/components/layout/Card', () => ({
  default: ({ variant, entityType, card, onPreview, onAction, actionLabel, locked, lockedIcon, lockInfo, additionalCardClasses }) =>
    variant === 'page' ? <div data-testid="page-card">{card?.title}</div> : (
      <div data-testid={`cc-${entityType}`} data-locked={String(!!locked)} data-lock-info={lockInfo?.label ?? ''}
        data-lock-icon={lockedIcon ?? ''} data-img={card?.urlImage ?? ''} className={additionalCardClasses ?? ''}>
        <span>{card?.title}</span>
        {onPreview && <button data-testid={`preview-${entityType}`} onClick={onPreview}>i</button>}
        {onAction && <button data-testid={`action-${entityType}`} onClick={onAction}>{actionLabel}</button>}
      </div>
    ),
}))

import StartMatchFlow from '../features/start-match/StartMatchFlow'

const STORY = { uuid: 's1', title: 'The Lost Crown', card: { title: 'The Lost Crown' } }
const CONFIG = { character: { uuid: 'ch1', name: 'Ranger' }, class: { uuid: 'cl1', name: 'Mage' }, traits: [] }

function renderFlow() {
  return render(<MemoryRouter><StartMatchFlow story={STORY} config={CONFIG} storyId="s1" /></MemoryRouter>)
}

describe('StartMatchFlow v1.2.0 — login card', () => {
  const openGuestModal = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('a Google user: name, picture, green Logged check, (i) opens the user book', () => {
    ctx.value = { isGoogleUser: true, googleEnabled: true, openGuestModal,
      user: { userUuid: 'u1', accessToken: 'tok', displayName: 'Mario Rossi', pictureUrl: 'p=s96-c' } }
    renderFlow()
    const login = screen.getByTestId('cc-login')
    expect(login).toHaveTextContent('Mario Rossi')
    expect(login.dataset.img).toBe('p=s256-c')
    expect(login.dataset.locked).toBe('true')
    expect(login.dataset.lockInfo).toBe('book.logged')
    expect(login.dataset.lockIcon).toBe('fas fa-check')
    expect(login.className).toBe('pg-card--logged')
    fireEvent.click(screen.getByTestId('preview-login'))
    expect(openGuestModal).toHaveBeenCalled()
  })

  it('a guest with Google on: Guest user with a Login button to the user book', () => {
    ctx.value = { isGoogleUser: false, googleEnabled: true, openGuestModal, user: { userUuid: 'u1', accessToken: 'tok' } }
    renderFlow()
    const login = screen.getByTestId('cc-login')
    expect(login).toHaveTextContent('book.guest')
    expect(login.dataset.locked).toBe('false')
    fireEvent.click(screen.getByTestId('action-login'))
    expect(openGuestModal).toHaveBeenCalled()
    expect(screen.getByTestId('action-login')).toHaveTextContent('book.login')
    fireEvent.click(screen.getByTestId('preview-login'))
    expect(screen.getByTestId('page-card')).toHaveTextContent('book.guest')
  })

  it('a guest with Google off keeps the locked card', () => {
    ctx.value = { isGoogleUser: false, googleEnabled: false, openGuestModal, user: { userUuid: 'u1', accessToken: 'tok' } }
    renderFlow()
    expect(screen.getByTestId('cc-login').dataset.lockInfo).toBe('book.guestLock')
    expect(screen.queryByTestId('action-login')).toBeNull()
  })
})

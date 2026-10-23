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
const modal = vi.hoisted(() => ({ props: null }))
vi.mock('@/components/modals/CardPreviewModal', () => ({
  default: (props) => { modal.props = props; return props.preview?.additionalProps?.extraContent ?? null },
}))
vi.mock('@/features/guest-user/GoogleSignInButton', () => ({
  default: ({ autoStart, compact }) => <div data-testid="google-signin" data-auto={String(!!autoStart)} data-compact={String(!!compact)} />,
}))
vi.mock('@/components/layout/Card', () => ({
  default: ({ variant, entityType, card, onPreview, onAction, actionLabel, onSelect, selectLabel, locked, lockedIcon, lockInfo,
    additionalCardClasses, extraContent }) =>
    variant === 'page' ? <div data-testid="page-card" data-img={card?.urlImage ?? ''}>{card?.title}{extraContent}</div> : (
      <div data-testid={`cc-${entityType}`} data-locked={String(!!locked)} data-lock-info={lockInfo?.label ?? ''}
        data-lock-icon={lockedIcon ?? ''} data-img={card?.urlImage ?? ''} className={additionalCardClasses ?? ''}>
        <span>{card?.title}</span>
        {onPreview && <button data-testid={`preview-${entityType}`} onClick={onPreview}>i</button>}
        {onAction && <button data-testid={`action-${entityType}`} onClick={onAction}>{actionLabel}</button>}
        {onSelect && <button data-testid={`select-${entityType}`} onClick={onSelect}>{selectLabel}</button>}
        {extraContent}
      </div>
    ),
}))

import StartMatchFlow from '../features/start-match/StartMatchFlow'

const STORY = { uuid: 's1', title: 'The Lost Crown', card: { title: 'The Lost Crown', urlImage: 'story.jpg' } }
const CONFIG = { character: { uuid: 'ch1', name: 'Ranger' }, class: { uuid: 'cl1', name: 'Mage' }, traits: [] }

function renderFlow() {
  return render(<MemoryRouter><StartMatchFlow story={STORY} config={CONFIG} storyId="s1" /></MemoryRouter>)
}

describe('StartMatchFlow v1.2.0 — login card', () => {
  const openGuestModal = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('a Google user: name, picture, an (i) that opens the user book; the story stays on the left page', () => {
    ctx.value = { isGoogleUser: true, googleEnabled: true, openGuestModal,
      user: { userUuid: 'u1', accessToken: 'tok', displayName: 'Mario Rossi', pictureUrl: 'p=s96-c' } }
    renderFlow()
    const login = screen.getByTestId('cc-login')
    expect(login).toHaveTextContent('Mario Rossi')
    expect(login.dataset.img).toBe('p=s256-c')
    // v1.8.0 — no lock any more: the (i) is the card's only button
    expect(login.dataset.locked).toBe('false')
    expect(login.className).toBe('pg-card--logged')
    expect(screen.queryByTestId('select-login')).toBeNull()
    expect(screen.getByTestId('page-card')).toHaveTextContent('The Lost Crown')
    fireEvent.click(screen.getByTestId('preview-login'))
    expect(openGuestModal).toHaveBeenCalled()
    expect(screen.queryByTestId('account-hint')).toBeNull()
  })

  it('a guest with Google on: the small card is the hint and Login, which opens the guest page with Google', () => {
    ctx.value = { isGoogleUser: false, googleEnabled: true, openGuestModal, user: { userUuid: 'u1', accessToken: 'tok' } }
    const { rerender } = renderFlow()
    const login = screen.getByTestId('cc-login')
    expect(login).toHaveTextContent('book.guest')
    expect(login.dataset.locked).toBe('false')
    // v1.7.0 step 9 — the hint before Play
    expect(screen.getByTestId('account-hint')).toHaveTextContent('startMatch.accountHint')
    // v1.8.0 — no artwork and no (i) in the small card
    expect(login.dataset.img).toBe('')
    expect(login.className).toBe('pg-card--login-guest')
    expect(screen.queryByTestId('preview-login')).toBeNull()
    expect(screen.getByTestId('select-login')).toHaveTextContent('book.login')
    // the left page is the guest page, with the story artwork and a Google button loaded on click only
    const page = screen.getByTestId('page-card')
    expect(page).toHaveTextContent('book.guest')
    expect(page.dataset.img).toBe('story.jpg')
    expect(page.querySelector('[data-testid="google-signin"]').dataset.auto).toBe('false')
    // Login: the guest page takes the left page with the Google button, started at once
    fireEvent.click(screen.getByTestId('select-login'))
    expect(openGuestModal).not.toHaveBeenCalled()
    expect(screen.getByTestId('page-card')).toHaveTextContent('book.guest')
    expect(screen.getAllByTestId('google-signin')).toHaveLength(1)
    expect(screen.getByTestId('page-card').querySelector('[data-testid="google-signin"]').dataset.auto).toBe('true')
    expect(screen.queryByRole('alert')).toBeNull()
    // the login is done: back to the story page
    ctx.value = { ...ctx.value, isGoogleUser: true, user: { userUuid: 'u1', accessToken: 'tok', displayName: 'Mario' } }
    rerender(<MemoryRouter><StartMatchFlow story={STORY} config={CONFIG} storyId="s1" /></MemoryRouter>)
    expect(screen.getByTestId('page-card')).toHaveTextContent('The Lost Crown')
    expect(screen.queryByTestId('google-signin')).toBeNull()
  })

  it('v1.8.0 — on mobile the guest page opens in the modal, the Google button inside it; the login closes it', () => {
    const hide = vi.fn()
    const show = vi.fn()
    const el = document.createElement('div')
    el.id = 'cardPreviewModal'
    document.body.appendChild(el)
    window.bootstrap = { Modal: { getOrCreateInstance: () => ({ show }), getInstance: () => ({ hide }) } }
    const mm = window.matchMedia
    window.matchMedia = vi.fn(() => ({ matches: true }))
    try {
      ctx.value = { isGoogleUser: false, googleEnabled: true, openGuestModal, user: { userUuid: 'u1', accessToken: 'tok' } }
      const { rerender } = renderFlow()
      fireEvent.click(screen.getByTestId('select-login'))
      expect(show).toHaveBeenCalled()
      expect(modal.props.preview.type).toBe('login')
      expect(screen.getByTestId('page-card').querySelector('[data-testid="google-signin"]')).toBeNull()
      expect(screen.getAllByTestId('google-signin')).toHaveLength(1)
      ctx.value = { ...ctx.value, isGoogleUser: true, user: { userUuid: 'u1', accessToken: 'tok', displayName: 'Mario' } }
      rerender(<MemoryRouter><StartMatchFlow story={STORY} config={CONFIG} storyId="s1" /></MemoryRouter>)
      expect(hide).toHaveBeenCalled()
      expect(modal.props.preview).toBeNull()
    } finally {
      window.matchMedia = mm
      delete window.bootstrap
      el.remove()
    }
  })

  it('v1.8.0 — a refused Google login is said on the guest page', () => {
    ctx.value = { isGoogleUser: false, googleEnabled: true, openGuestModal, authError: 'EMAIL_DOMAIN_NOT_ALLOWED',
      user: { userUuid: 'u1', accessToken: 'tok' } }
    renderFlow()
    // the mocked t answers the key itself: an untranslated code reads as the generic failure
    expect(screen.getByRole('alert')).toHaveTextContent('auth.errors.GOOGLE_LOGIN_FAILED')
    fireEvent.click(screen.getByTestId('select-login'))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('a guest with Google off keeps the locked card', () => {
    ctx.value = { isGoogleUser: false, googleEnabled: false, openGuestModal, user: { userUuid: 'u1', accessToken: 'tok' } }
    renderFlow()
    expect(screen.getByTestId('cc-login').dataset.lockInfo).toBe('book.guestLock')
    expect(screen.queryByTestId('select-login')).toBeNull()
    expect(screen.queryByTestId('account-hint')).toBeNull()
  })
})

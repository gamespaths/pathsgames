import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Coverage-focused suite for the fixed cards block of the start-match book: every
// card's (i) lens routes its own card to the left reading page, and on mobile the
// same lens opens the Bootstrap preview modal instead.

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { userUuid: 'u1', accessToken: 'tok' } }),
}))
vi.mock('@/api/matches', () => ({ createMatch: vi.fn(), joinMatch: vi.fn(), startMatch: vi.fn() }))
const openPolicyBook = vi.fn()
vi.mock('@/context/PolicyBookContext', () => ({
  usePolicyBook: () => ({ policyBook: null, openPolicyBook, closePolicyBook: vi.fn() }),
}))
// The antibot gate is already verified: the flow starts in its 'confirm' phase.
vi.mock('@/hooks/useAntibot', () => ({
  default: () => ({ phase: 'ready', token: 'tok-cf', retry: vi.fn() }),
}))
vi.mock('@/components/book/Book', () => ({
  default: ({ left, right }) => <div data-testid="book">{left}{right}</div>,
}))
vi.mock('@/components/modals/CardPreviewModal', () => ({
  default: ({ preview }) => <div data-testid="preview-modal">{preview?.card?.title}</div>,
}))
// The dumb Card stand-in: `variant="page"` marks the reading page, every other
// instance is a board card whose (i) and select handlers become buttons.
vi.mock('@/components/layout/Card', () => ({
  default: ({ variant, entityType, card, onPreview, onSelect, selectLabel, onAction, actionLabel, locked, lockedReason, lockInfo, statistics }) => (
    <div data-testid={variant === 'page' ? 'page-card' : `cc-${entityType}`} data-locked={String(!!locked)} data-lock-reason={lockedReason ?? ''}
         data-lock-info={lockInfo?.label ?? ''}
         data-stats={(statistics ?? []).map(i => `${i.key}=${i.value}`).join(',')}>
      <span>{card?.title}</span>
      {onPreview && <button data-testid={`preview-${entityType ?? 'page'}`} onClick={onPreview}>i</button>}
      {onSelect && <button data-testid={`select-${entityType}`} onClick={onSelect}>{selectLabel}</button>}
      {onAction && <button data-testid={`action-${entityType}`} onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
}))

import StartMatchFlow from '../features/start-match/StartMatchFlow'

const STORY = { uuid: 's1', title: 'The Lost Crown', card: { title: 'The Lost Crown' } }
const CONFIG = {
  character: { uuid: 'ch1', name: 'Ranger', lifeMax: 10 },
  class: { uuid: 'cl1', name: 'Mage', weightMax: 4 },
  traits: [{ uuid: 'tr1', name: 'Brave', costPositive: 1 }],
  difficulty: { uuid: 'df1', name: 'Normal', traitCostPositiveBudget: 2 },
}

function renderFlow() {
  return render(
    <MemoryRouter>
      <StartMatchFlow story={STORY} config={CONFIG} storyId="s1" />
    </MemoryRouter>
  )
}

describe('StartMatchFlow — the fixed cards block', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => { delete window.matchMedia; delete window.bootstrap })

  it('renders the fixed cards in order: story, gameType, bonuses, login, terms, bonuses', () => {
    renderFlow()
    const order = Array.from(document.querySelectorAll('[data-testid^="cc-"]')).map(el => el.dataset.testid)
    expect(order).toEqual(['cc-story', 'cc-gameType', 'cc-bonuses', 'cc-login', 'cc-terms', 'cc-bonuses'])
  })

  it('locks game type and login with their own lock labels, not with the card titles', () => {
    renderFlow()
    const gameType = screen.getByTestId('cc-gameType')
    const login = screen.getByTestId('cc-login')
    expect(gameType.dataset.locked).toBe('true')
    expect(gameType.dataset.lockInfo).toBe('book.singlePlayer')
    expect(login.dataset.locked).toBe('true')
    expect(login.dataset.lockInfo).toBe('book.guestLock')
  })

  // "Start" is the action of the last bonuses card: offered once the gate passed and the
  // terms are accepted, locked (with the reason) otherwise. No Home button: the (x) is home.
  it('offers Start on the last bonuses card and locks it while the terms are refused', () => {
    renderFlow()
    const [first, last] = screen.getAllByTestId('cc-bonuses')
    expect(first.dataset.locked).toBe('false')
    expect(last.dataset.locked).toBe('false')
    expect(screen.getByTestId('action-bonuses')).toHaveTextContent('book.start')
    expect(screen.queryByText('startMatch.home')).toBeNull()
    fireEvent.click(screen.getAllByTestId('select-terms')[0])
    expect(screen.queryByTestId('action-bonuses')).toBeNull()
    expect(screen.getAllByTestId('cc-bonuses')[1].dataset.locked).toBe('true')
    expect(screen.getAllByTestId('cc-bonuses')[1].dataset.lockReason).toBe('startMatch.acceptTermsFirst')
  })

  // The first bonuses card carries the characteristics and the carry, the second the pools
  // and the trait cost used/max against the difficulty budgets.
  it('splits the totals over the two bonuses cards, trait cost on the second', () => {
    renderFlow()
    const [first, last] = screen.getAllByTestId('cc-bonuses')
    expect(first.dataset.stats).toBe('weight=4')
    expect(last.dataset.stats).toBe('life=10,costPositive=1/2')
  })

  // Start swaps the six cards for the phase cards: the story, then creating / joining /
  // running / created, all locked under their status.
  it('Start on the card swaps the board for the phase cards', () => {
    renderFlow()
    fireEvent.click(screen.getByTestId('action-bonuses'))
    expect(screen.queryByTestId('action-bonuses')).toBeNull()
    expect(screen.queryAllByTestId('cc-bonuses')).toHaveLength(0)
    const order = Array.from(document.querySelectorAll('[data-testid^="cc-"]')).map(el => el.dataset.testid)
    expect(order).toEqual(['cc-story', 'cc-phase', 'cc-phase', 'cc-phase', 'cc-phase'])
    expect(screen.getByTestId('cc-story').dataset.locked).toBe('true')
    expect(screen.getAllByTestId('cc-phase').map(el => el.textContent))
      .toEqual(['startMatch.phaseTitle.creating', 'startMatch.phaseTitle.joining', 'startMatch.phaseTitle.running', 'startMatch.phaseTitle.created'])
  })

  // The story lens puts the story card on the reading page; its action is "Back".
  it('routes the story lens to the left reading page and offers Back on the card', () => {
    renderFlow()
    fireEvent.click(screen.getAllByTestId('preview-story')[0])
    expect(screen.getAllByTestId('preview-modal')[0]).toHaveTextContent('The Lost Crown')
    expect(screen.getByTestId('action-story')).toHaveTextContent('book.back')
  })

  // The first bonuses lens opens the character-attributes page; the second keeps the
  // statistics card (its (i) is hidden on the real Card, the handler stays wired).
  it('routes the bonus lenses to the reading page', () => {
    renderFlow()
    fireEvent.click(screen.getAllByTestId('preview-bonuses')[0])
    expect(screen.getAllByTestId('preview-modal')[0]).toHaveTextContent('book.characterAttributesTitle')
    fireEvent.click(screen.getAllByTestId('preview-bonuses')[1])
    expect(screen.getAllByTestId('preview-modal')[0]).not.toHaveTextContent('book.characterAttributesTitle')
  })

  it('routes the game-type and login lenses to the reading page', () => {
    renderFlow()
    fireEvent.click(screen.getAllByTestId('preview-gameType')[0])
    expect(screen.getAllByTestId('preview-modal')[0]).toHaveTextContent('book.single')
    fireEvent.click(screen.getAllByTestId('preview-login')[0])
    expect(screen.getAllByTestId('preview-modal')[0]).not.toHaveTextContent('book.single')
  })

  // The terms card is the only interactive one: its button toggles the gate.
  it('toggles the terms acceptance from the terms card', () => {
    renderFlow()
    expect(screen.getAllByTestId('select-terms')[0]).toHaveTextContent('book.accepted')
    fireEvent.click(screen.getAllByTestId('select-terms')[0])
    expect(screen.getAllByTestId('select-terms')[0]).toHaveTextContent('book.accept')
  })

  // The terms lens opens the Terms & Conditions book.
  it('opens the terms book from the terms lens', () => {
    renderFlow()
    fireEvent.click(screen.getAllByTestId('preview-terms')[0])
    expect(openPolicyBook).toHaveBeenCalledWith('terms')
  })

  // On mobile there is no left page, so the lens opens the preview modal.
  it('opens the Bootstrap preview modal when a lens is used on mobile', () => {
    const show = vi.fn()
    window.matchMedia = vi.fn(() => ({ matches: true }))
    window.bootstrap = { Modal: { getOrCreateInstance: vi.fn(() => ({ show })) } }
    const el = document.createElement('div')
    el.id = 'cardPreviewModal'
    document.body.appendChild(el)
    try {
      renderFlow()
      fireEvent.click(screen.getAllByTestId('preview-story')[0])
      expect(show).toHaveBeenCalled()
    } finally {
      document.body.removeChild(el)
    }
  })
})

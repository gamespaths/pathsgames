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
  default: ({ variant, entityType, card, onPreview, onSelect, selectLabel }) => (
    <div data-testid={variant === 'page' ? 'page-card' : `cc-${entityType}`}>
      <span>{card?.title}</span>
      {onPreview && <button data-testid={`preview-${entityType ?? 'page'}`} onClick={onPreview}>i</button>}
      {onSelect && <button data-testid={`select-${entityType}`} onClick={onSelect}>{selectLabel}</button>}
    </div>
  ),
}))

import StartMatchFlow from '../features/start-match/StartMatchFlow'

const STORY = { uuid: 's1', title: 'The Lost Crown', card: { title: 'The Lost Crown' } }
const CONFIG = {
  character: { uuid: 'ch1', name: 'Ranger' },
  class: { uuid: 'cl1', name: 'Mage' },
  traits: [{ uuid: 'tr1', name: 'Brave' }],
  difficulty: { uuid: 'df1', name: 'Normal' },
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

  it('renders one card per fixed entry (story, both bonus cards, gameType, login, terms)', () => {
    renderFlow()
    expect(screen.getByTestId('cc-story')).toBeInTheDocument()
    expect(screen.getAllByTestId('cc-bonuses')).toHaveLength(2)
    expect(screen.getByTestId('cc-gameType')).toBeInTheDocument()
    expect(screen.getByTestId('cc-login')).toBeInTheDocument()
    expect(screen.getByTestId('cc-terms')).toBeInTheDocument()
  })

  // The story lens puts the story card on the reading page.
  it('routes the story lens to the left reading page', () => {
    renderFlow()
    fireEvent.click(screen.getAllByTestId('preview-story')[0])
    expect(screen.getAllByTestId('preview-modal')[0]).toHaveTextContent('The Lost Crown')
  })

  // Both bonus cards preview the same statistics card with their own subset of stats.
  it('routes both bonus lenses to the reading page', () => {
    renderFlow()
    fireEvent.click(screen.getAllByTestId('preview-bonuses')[0])
    expect(screen.getByTestId('book')).toBeInTheDocument()
    fireEvent.click(screen.getAllByTestId('preview-bonuses')[1])
    expect(screen.getByTestId('book')).toBeInTheDocument()
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

  // The terms lens opens the shared Terms & Conditions Bootstrap modal.
  it('opens the terms modal from the terms lens', () => {
    const show = vi.fn()
    window.bootstrap = { Modal: { getOrCreateInstance: vi.fn(() => ({ show })) } }
    const el = document.createElement('div')
    el.id = 'termsModal'
    document.body.appendChild(el)
    try {
      renderFlow()
      fireEvent.click(screen.getAllByTestId('preview-terms')[0])
      expect(show).toHaveBeenCalled()
    } finally {
      document.body.removeChild(el)
    }
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

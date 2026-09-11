import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right }) => <div data-testid="book">{left}{right}</div>,
}))
// One mock for every Card: the title, a back arrow and an (i), so the flow is driven by clicks.
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, variant, entityType, onClose, onPreview, onAction, locked }) => (
    <div data-testid={variant === 'page' ? 'page' : 'card'} data-type={entityType}
      data-locked={String(!!locked)}>
      <span>{card?.title ?? card?.name}</span>
      {onClose && <button onClick={onClose}>back:{card?.title ?? card?.name}</button>}
      {onPreview && <button onClick={onPreview}>info:{card?.title ?? card?.name}</button>}
      {onAction && <button onClick={onAction}>action:{card?.title}</button>}
    </div>
  ),
}))

import EndGameBook from '../features/gameplay/EndGameBook'

const STORY = { title: 'Epic Quest', card: { title: 'Epic Quest' } }
const END_CARD = { title: 'Victory!' }
const MISSIONS = [
  { uuid: 'm-1', name: 'Find the key', status: 'COMPLETED', steps: [
    { uuid: 's-1', name: 'Reach the hills', done: true },
    { uuid: 's-2', name: 'Climb the peak', done: false },
  ] },
  { uuid: 'm-2', name: 'Save the king', status: 'ACTIVE', steps: [] },
]

function wrap(props = {}) {
  return render(
    <MemoryRouter>
      <EndGameBook story={STORY} endGameCard={END_CARD} onClose={vi.fn()} missions={MISSIONS}
        {...props} />
    </MemoryRouter>
  )
}

describe('EndGameBook — missions first (v0.37.4)', () => {
  it('opens on the missions: the missions card on the left, the grid on the right', () => {
    wrap()
    expect(screen.getByText('game.missions.title')).toBeInTheDocument()
    expect(screen.getAllByTestId('card').map(n => n.querySelector('span').textContent))
      .toEqual(['Save the king', 'Find the key'])
    expect(screen.queryByText('Victory!')).toBeNull()
  })

  it('turns to the ending through the back arrow of the missions card', () => {
    wrap()
    fireEvent.click(screen.getByText('back:game.missions.title'))
    expect(screen.getAllByTestId('page').map(n => n.querySelector('span').textContent))
      .toEqual(['Epic Quest', 'Victory!'])
    expect(screen.queryByText('game.missions.title')).toBeNull()
  })

  it('opens one mission down to its steps, and back to the grid', () => {
    wrap()
    fireEvent.click(screen.getByText('info:Find the key'))
    // The mission reads on the left page, its steps — open one first — on the right.
    expect(screen.getByTestId('page').textContent).toContain('Find the key')
    expect(screen.getAllByTestId('card').map(n => n.querySelector('span').textContent))
      .toEqual(['Climb the peak', 'Reach the hills'])

    fireEvent.click(screen.getByText('back:Find the key'))
    expect(screen.getByText('game.missions.title')).toBeInTheDocument()
    expect(screen.getAllByTestId('card')).toHaveLength(2)
  })

  it('reads a step through its (i) on the right page, and closes it back to the steps', () => {
    wrap()
    fireEvent.click(screen.getByText('info:Find the key'))
    fireEvent.click(screen.getByText('info:Climb the peak'))
    const pages = screen.getAllByTestId('page')
    expect(pages).toHaveLength(2)
    expect(pages[1].textContent).toContain('Climb the peak')
    expect(pages[1].dataset.type).toBe('missions')

    fireEvent.click(screen.getByText('back:Climb the peak'))
    expect(screen.getAllByTestId('page')).toHaveLength(1)
    expect(screen.getAllByTestId('card')).toHaveLength(2)
  })

  it('leaves for the home page through the end-game card action', () => {
    const original = window.location
    delete window.location
    window.location = { href: '/play' }
    wrap({ missions: [] })
    fireEvent.click(screen.getByText('action:Victory!'))
    expect(window.location.href).toBe('/')
    window.location = original
  })

  it('skips straight to the ending when the match has no missions', () => {
    wrap({ missions: [] })
    expect(screen.getAllByTestId('page').map(n => n.querySelector('span').textContent))
      .toEqual(['Epic Quest', 'Victory!'])
    wrap({ missions: null })
    expect(screen.queryByText('game.missions.title')).toBeNull()
  })
})

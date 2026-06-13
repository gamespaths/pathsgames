import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

import TurnPanel from '../features/gameplay/TurnPanel'

const RUNNING_SEQUENCE = {
  matchUuid: 'm1',
  currentClock: 0,
  status: 'RUNNING',
  activeCharacterUuid: 'c1',
  queue: [
    { characterUuid: 'c1', idCharacter: 1, name: 'Alice', priority: 200, status: 'ACTIVE', passCounter: 0 },
    { characterUuid: 'c2', idCharacter: 2, name: 'Bob', priority: 100, status: 'WAITING', passCounter: 2 },
  ],
}

describe('TurnPanel', () => {
  it('shows the Start button when the match has not started', () => {
    render(<TurnPanel sequence={{ status: 'CREATED', queue: [] }} onStart={vi.fn()} onPass={vi.fn()} />)
    expect(screen.getByTestId('turn-start-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('turn-pass-btn')).not.toBeInTheDocument()
  })

  it('renders the empty message when the queue is empty', () => {
    render(<TurnPanel sequence={{ status: 'CREATED', queue: [] }} />)
    expect(screen.getByText('game.turn.empty')).toBeInTheDocument()
  })

  it('shows the Pass button and the queue when RUNNING', () => {
    render(<TurnPanel sequence={RUNNING_SEQUENCE} onStart={vi.fn()} onPass={vi.fn()} />)
    expect(screen.getByTestId('turn-pass-btn')).toBeInTheDocument()
    expect(screen.getAllByTestId('turn-queue-item')).toHaveLength(2)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('marks the active character row with is-active', () => {
    render(<TurnPanel sequence={RUNNING_SEQUENCE} />)
    const items = screen.getAllByTestId('turn-queue-item')
    expect(items[0].className).toContain('is-active')
    expect(items[1].className).not.toContain('is-active')
  })

  it('shows the pass counter only when greater than zero', () => {
    render(<TurnPanel sequence={RUNNING_SEQUENCE} />)
    expect(screen.getByText('×2')).toBeInTheDocument()
    expect(screen.queryByText('×0')).not.toBeInTheDocument()
  })

  it('calls onStart when the Start button is clicked', () => {
    const onStart = vi.fn()
    render(<TurnPanel sequence={{ status: 'CREATED', queue: [] }} onStart={onStart} />)
    fireEvent.click(screen.getByTestId('turn-start-btn'))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('calls onPass when the Pass button is clicked', () => {
    const onPass = vi.fn()
    render(<TurnPanel sequence={RUNNING_SEQUENCE} onPass={onPass} />)
    fireEvent.click(screen.getByTestId('turn-pass-btn'))
    expect(onPass).toHaveBeenCalledTimes(1)
  })

  it('disables the action button while busy', () => {
    render(<TurnPanel sequence={RUNNING_SEQUENCE} onPass={vi.fn()} busy />)
    expect(screen.getByTestId('turn-pass-btn')).toBeDisabled()
  })

  it('renders safely when sequence is undefined (defaults to Start)', () => {
    render(<TurnPanel />)
    expect(screen.getByTestId('turn-start-btn')).toBeInTheDocument()
    expect(screen.getByTestId('turn-status')).toHaveTextContent('CREATED')
  })
})

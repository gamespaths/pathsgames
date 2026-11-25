import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import CardBack, { D20_PATH } from '../components/layout/CardBack'
import Deck from '../components/book/Deck'
import { AnimationProvider } from '../context/AnimationContext'
import favicon from '../../public/favicon.svg?raw'

// Step 14 — the card back (the site's d20) and the two decks the cards are dealt from.
describe('CardBack', () => {
  it('draws the favicon d20 as an inline SVG, pulsing, hidden from assistive tech', () => {
    const { container } = render(<CardBack className="pg-card__face pg-card__back" />)
    const back = container.firstChild
    expect(back).toHaveClass('pg-back', 'pg-card__face', 'pg-card__back')
    expect(back).toHaveAttribute('aria-hidden', 'true')
    const svg = back.querySelector('svg.pg-d20')
    expect(svg).toHaveClass('pg-d20--pulse')
    expect(svg).toHaveAttribute('viewBox', '0 0 64 64')
    expect(svg.querySelector('g')).toHaveAttribute('fill', 'currentColor')
    expect(svg.querySelector('path')).toHaveAttribute('d', D20_PATH)
    expect(back.children).toHaveLength(1)
  })

  it('pulse={false}: a still, dimmer d20', () => {
    const { container } = render(<CardBack pulse={false} />)
    expect(container.firstChild.className).toBe('pg-back')
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('pg-d20--still')
    expect(svg).not.toHaveClass('pg-d20--pulse')
  })

  it('uses the same d20 path as public/favicon.svg', () => {
    expect(favicon).toContain(`d="${D20_PATH}"`)
  })
})

describe('Deck', () => {
  it('table pile: ten backs, only the top one pulsing, under the book by default', () => {
    const { container } = render(<AnimationProvider env={{}}><Deck /></AnimationProvider>)
    const pile = container.querySelector('.deck-pile')
    expect(pile).toHaveAttribute('aria-hidden', 'true')
    expect(pile).toHaveAttribute('data-place', 'under')
    const backs = pile.querySelectorAll(':scope > .pg-back.deck-pile__card')
    expect(backs).toHaveLength(10)
    expect(pile.querySelectorAll('.pg-d20--pulse')).toHaveLength(1)
    expect(pile.querySelectorAll('.pg-d20--still')).toHaveLength(9)
    expect(backs[9]).toHaveClass('deck-pile__top')
    expect(backs[9].querySelector('.pg-d20--pulse')).toBeInTheDocument()
  })

  it('data-place follows the deck setting (VITE_ANIM_DECK=over)', () => {
    const { container } = render(<AnimationProvider env={{ VITE_ANIM_DECK: 'over' }}><Deck variant="table" /></AnimationProvider>)
    expect(container.querySelector('.deck-pile')).toHaveAttribute('data-place', 'over')
  })

  it('page deck: three backs, the top one pulsing', () => {
    const { container } = render(<Deck variant="page" />)
    const deck = container.querySelector('.deck')
    expect(deck).toHaveAttribute('aria-hidden', 'true')
    expect(deck.querySelectorAll(':scope > .pg-back.deck__card')).toHaveLength(3)
    expect(deck.querySelectorAll('.pg-d20--pulse')).toHaveLength(1)
    expect(deck.lastChild).toHaveClass('deck__top')
    expect(container.querySelector('.deck-pile')).toBeNull()
  })
})

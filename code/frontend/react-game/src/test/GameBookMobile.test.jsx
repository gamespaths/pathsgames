import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import GameBookMobile from '../features/gameplay/GameBookMobile'

describe('GameBookMobile', () => {
  it('stacks the provided left and right content (left on top)', () => {
    render(
      <GameBookMobile
        left={<div data-testid="left">L</div>}
        right={<div data-testid="right">R</div>}
      />
    )
    const layout = document.querySelector('.book-mobile-layout')
    const left = screen.getByTestId('left')
    const right = screen.getByTestId('right')
    expect(layout).toContainElement(left)
    expect(layout).toContainElement(right)
    // left renders before right in document order (stacked above).
    expect(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the end error when provided', () => {
    render(<GameBookMobile left={null} right={null} endError="boom" />)
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('renders without left/right content without crashing', () => {
    render(<GameBookMobile />)
    expect(document.querySelector('.book-mobile-layout')).toBeInTheDocument()
  })
})

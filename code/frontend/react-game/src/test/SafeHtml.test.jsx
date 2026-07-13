import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SafeHtml from '../components/ui/SafeHtml'

describe('SafeHtml', () => {
  it('renders a React element directly', () => {
    render(<SafeHtml value={<span data-testid="el">hi</span>} />)
    expect(screen.getByTestId('el')).toBeInTheDocument()
  })

  it('injects an HTML string as sanitized markup', () => {
    const { container } = render(<SafeHtml value="<b>bold</b>" />)
    expect(container.querySelector('b')?.textContent).toBe('bold')
  })

  it('renders nothing for null/undefined', () => {
    const { container } = render(<SafeHtml value={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('updates the rendered HTML when value changes', () => {
    const { container, rerender } = render(<SafeHtml value="<p>first</p>" />)
    expect(container.querySelector('p')?.textContent).toBe('first')
    rerender(<SafeHtml value="<p>second</p>" />)
    expect(container.querySelector('p')?.textContent).toBe('second')
  })

  it('transitions from null to string correctly', () => {
    const { container, rerender } = render(<SafeHtml value={null} />)
    expect(container.firstChild).toBeNull()
    rerender(<SafeHtml value="<b>appeared</b>" />)
    expect(container.querySelector('b')?.textContent).toBe('appeared')
  })
})

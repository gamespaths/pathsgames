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
})

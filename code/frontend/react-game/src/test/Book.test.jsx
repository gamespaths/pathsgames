import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Book from '../components/book/Book'

describe('Book', () => {
  it('renders left and right content', () => {
    render(<Book left={<span>Left content</span>} right={<span>Right content</span>} />)
    expect(screen.getByText('Left content')).toBeInTheDocument()
    expect(screen.getByText('Right content')).toBeInTheDocument()
  })

  it('renders close button when onClose is provided', () => {
    const onClose = vi.fn()
    render(<Book left={null} right={null} onClose={onClose} />)
    const btn = screen.getByLabelText('Close')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not render close button when onClose is omitted', () => {
    render(<Book left={null} right={null} />)
    expect(screen.queryByLabelText('Close')).toBeNull()
  })

  it('applies custom overlayClass and wrapperClass', () => {
    const { container } = render(
      <Book left={null} right={null} overlayClass="custom-overlay" wrapperClass="custom-wrapper" />
    )
    expect(container.querySelector('.custom-overlay')).toBeInTheDocument()
    expect(container.querySelector('.custom-wrapper')).toBeInTheDocument()
  })

  it('renders mobile slot when provided', () => {
    render(<Book left={null} right={null} mobile={<div>mobile-ui</div>} />)
    expect(screen.getByText('mobile-ui')).toBeInTheDocument()
  })

  it('renders book-spine inside the wrapper', () => {
    const { container } = render(<Book left={null} right={null} />)
    expect(container.querySelector('.book-spine')).toBeInTheDocument()
  })
})

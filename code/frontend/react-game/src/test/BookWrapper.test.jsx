import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import BookWrapper from '../components/book/BookWrapper'

describe('BookWrapper', () => {
  it('renders children', () => {
    render(<BookWrapper><span>child content</span></BookWrapper>)
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('shows close button when onClose is provided', () => {
    const onClose = vi.fn()
    render(<BookWrapper onClose={onClose}><div /></BookWrapper>)
    const btn = screen.getByTitle('Close')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onClose).toHaveBeenCalled()
  })

  it('hides close button when onClose is not provided', () => {
    render(<BookWrapper><div /></BookWrapper>)
    expect(screen.queryByTitle('Close')).toBeNull()
  })

  it('applies extra className to the book-wrapper div', () => {
    const { container } = render(<BookWrapper className="extra-cls"><div /></BookWrapper>)
    expect(container.querySelector('.book-wrapper.extra-cls')).not.toBeNull()
  })
})

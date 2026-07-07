import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import CardCreditsBar from '../components/layout/CardCreditsBar'

describe('CardCreditsBar', () => {
  it('returns null when neither author nor image credit is provided', () => {
    const { container } = render(<CardCreditsBar card={{}} story={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when card and story are undefined', () => {
    const { container } = render(<CardCreditsBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders story author as plain text when no storyUrl', () => {
    render(<CardCreditsBar card={{}} story={{ author: 'Alice', card: {} }} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Alice' })).toBeNull()
  })

  it('renders story author as link when storyUrl is provided', () => {
    render(
      <CardCreditsBar
        card={{}}
        story={{ author: 'Alice', card: { linkCopyright: 'https://example.com' } }}
      />
    )
    const link = screen.getByRole('link', { name: 'Alice' })
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  it('renders image copyright as plain text when no imgUrl', () => {
    render(<CardCreditsBar card={{ copyrightText: 'Bob Photos' }} story={{}} />)
    expect(screen.getByText('Bob Photos')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bob Photos' })).toBeNull()
  })

  it('renders image copyright as link when imgUrl is provided', () => {
    render(
      <CardCreditsBar
        card={{ copyrightText: 'Bob Photos', linkCopyright: 'https://photos.example.com' }}
        story={{}}
      />
    )
    const link = screen.getByRole('link', { name: 'Bob Photos' })
    expect(link).toHaveAttribute('href', 'https://photos.example.com')
  })

  it('renders the entityType badge before the Credits label when provided', () => {
    const { container } = render(
      <CardCreditsBar card={{ copyrightText: 'Bob' }} story={{}} typeBadgeLabel="Personaggio" />
    )
    const badge = container.querySelector('.gc-type-badge-credits')
    expect(badge).toBeTruthy()
    expect(badge.textContent).toBe('Personaggio')
  })

  it('omits the entityType badge when no label is provided', () => {
    const { container } = render(<CardCreditsBar card={{ copyrightText: 'Bob' }} story={{}} />)
    expect(container.querySelector('.gc-type-badge-credits')).toBeFalsy()
  })

  it('renders both story author and image credit together', () => {
    const { container } = render(
      <CardCreditsBar
        card={{ copyrightText: 'Unsplash', linkCopyright: 'https://unsplash.com' }}
        story={{ author: 'Tolkien', card: { linkCopyright: 'https://tolkien.com' } }}
      />
    )
    expect(screen.getByText('Tolkien')).toBeInTheDocument()
    expect(screen.getByText('Unsplash')).toBeInTheDocument()
    // Both credit parts render together (author + image).
    expect(container.querySelector('.credit-author')).toBeTruthy()
    expect(container.querySelector('.credit-image')).toBeTruthy()
  })
})

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

  it('renders both story author and image credit together', () => {
    render(
      <CardCreditsBar
        card={{ copyrightText: 'Unsplash', linkCopyright: 'https://unsplash.com' }}
        story={{ author: 'Tolkien', card: { linkCopyright: 'https://tolkien.com' } }}
      />
    )
    expect(screen.getByText('Tolkien')).toBeInTheDocument()
    expect(screen.getByText('Unsplash')).toBeInTheDocument()
    expect(screen.getByText('Credits:')).toBeInTheDocument()
  })
})

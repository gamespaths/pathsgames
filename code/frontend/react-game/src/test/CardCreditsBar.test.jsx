import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import GameCardCreditsBar from '../components/layout/GameCardCreditsBar'

describe('GameCardCreditsBar', () => {
  it('returns null when neither author nor image credit is provided', () => {
    const { container } = render(<GameCardCreditsBar card={{}} story={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when card and story are undefined', () => {
    const { container } = render(<GameCardCreditsBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders story author as plain text when no storyUrl', () => {
    render(<GameCardCreditsBar card={{}} story={{ author: 'Alice', card: {} }} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Alice' })).toBeNull()
  })

  it('renders story author as link when storyUrl is provided', () => {
    render(
      <GameCardCreditsBar
        card={{}}
        story={{ author: 'Alice', card: { linkCopyright: 'https://example.com' } }}
      />
    )
    const link = screen.getByRole('link', { name: 'Alice' })
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  it('renders image copyright as plain text when no imgUrl', () => {
    render(<GameCardCreditsBar card={{ copyrightText: 'Bob Photos' }} story={{}} />)
    expect(screen.getByText('Bob Photos')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bob Photos' })).toBeNull()
  })

  it('renders image copyright as link when imgUrl is provided', () => {
    render(
      <GameCardCreditsBar
        card={{ copyrightText: 'Bob Photos', linkCopyright: 'https://photos.example.com' }}
        story={{}}
      />
    )
    const link = screen.getByRole('link', { name: 'Bob Photos' })
    expect(link).toHaveAttribute('href', 'https://photos.example.com')
  })

  it('renders both story author and image credit together', () => {
    render(
      <GameCardCreditsBar
        card={{ copyrightText: 'Unsplash', linkCopyright: 'https://unsplash.com' }}
        story={{ author: 'Tolkien', card: { linkCopyright: 'https://tolkien.com' } }}
      />
    )
    expect(screen.getByText('Tolkien')).toBeInTheDocument()
    expect(screen.getByText('Unsplash')).toBeInTheDocument()
    expect(screen.getByText('Credits:')).toBeInTheDocument()
  })
})

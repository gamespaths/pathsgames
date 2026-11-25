import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import BookBookmarks from '../components/book/BookBookmarks'

const ITEM = { key: 'map', icon: 'fas fa-map', label: 'Map', onClick: vi.fn() }

describe('BookBookmarks', () => {
  it('renders one tab per item, on the side it was given', () => {
    const { container } = render(<BookBookmarks side="right" items={[
      ITEM, { key: 'items', icon: 'fas fa-suitcase', label: 'Bag' },
    ]} />)

    expect(container.querySelector('.book-bookmarks--right')).toBeInTheDocument()
    expect(container.querySelectorAll('.book-bookmark').length).toBe(2)
    expect(screen.getByLabelText('Map').querySelector('i')).toHaveClass('fa-map')
  })

  it('renders nothing at all when there is no item (or none left after the filter)', () => {
    expect(render(<BookBookmarks items={[]} />).container.firstChild).toBeNull()
    expect(render(<BookBookmarks />).container.firstChild).toBeNull()
    expect(render(<BookBookmarks items={[null, false]} />).container.firstChild).toBeNull()
  })

  it('carries the stat badges of the page it opens', () => {
    render(<BookBookmarks items={[{ ...ITEM, badges: [{ key: 'life', label: 'Life', value: '3/10' }] }]} />)
    expect(screen.getByText('3/10')).toBeInTheDocument()
  })

  it('opens its view on click', () => {
    const onClick = vi.fn()
    render(<BookBookmarks items={[{ ...ITEM, onClick }]} />)
    fireEvent.click(screen.getByLabelText('Map'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is inert while its own page is open — the way back is that page\'s arrow', () => {
    const onClick = vi.fn()
    render(<BookBookmarks items={[{ ...ITEM, onClick, active: true }]} />)

    const tab = screen.getByLabelText('Map')
    expect(tab).toHaveClass('is-active')
    expect(tab).toHaveAttribute('aria-current', 'page')
    fireEvent.click(tab)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('greys out a feature that has not landed, and says so in the tooltip', () => {
    const onClick = vi.fn()
    render(<BookBookmarks items={[
      { key: 'missions', icon: 'fas fa-clipboard-list', label: 'Missions', disabled: true,
        title: 'coming soon', onClick },
    ]} />)

    const tab = screen.getByLabelText('Missions')
    expect(tab).toHaveClass('is-disabled')
    expect(tab).toHaveAttribute('aria-disabled', 'true')
    // aria-disabled, not the attribute: a disabled button would show no tooltip.
    expect(tab).not.toBeDisabled()
    expect(tab).toHaveAttribute('data-tip', 'coming soon')
    expect(tab).not.toHaveAttribute('title')
    fireEvent.click(tab)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('falls back to the label as tooltip when no title is given', () => {
    render(<BookBookmarks items={[ITEM]} />)
    expect(screen.getByLabelText('Map')).toHaveAttribute('data-tip', 'Map')
  })

  it('v1.13.0 — its badges carry no native title: the drawn tooltip names the tab', () => {
    const { container } = render(<BookBookmarks items={[{ ...ITEM, badges: [{ key: 'life', label: 'Life', value: '3/10' }] }]} />)
    const badge = container.querySelector('.book-bookmark .bonus-badge')
    expect(badge).toHaveAttribute('aria-label', 'Life')
    expect(badge).not.toHaveAttribute('title')
  })

  it('adds the item class (the home tab) to the tab', () => {
    render(<BookBookmarks items={[{ ...ITEM, className: 'book-bookmark--home' }]} />)
    expect(screen.getByLabelText('Map')).toHaveClass('book-bookmark', 'book-bookmark--home')
  })

  it('paints a tab red when its page holds news to act on', () => {
    render(<BookBookmarks items={[{ ...ITEM, danger: true }]} />)
    expect(screen.getByLabelText('Map')).toHaveClass('is-danger')
  })

  it('leaves a calm tab without the red class', () => {
    render(<BookBookmarks items={[ITEM]} />)
    expect(screen.getByLabelText('Map')).not.toHaveClass('is-danger')
  })
})

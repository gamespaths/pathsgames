import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

import LoadingCard from '../components/layout/LoadingCard'
import images from '@/data/images.json'

describe('LoadingCard', () => {
  it('renders the fixed "loading" card from data/images.json as a book page', () => {
    const { container } = render(<LoadingCard />)
    expect(screen.getByText('game.loadingCard.title')).toBeInTheDocument()
    expect(screen.getByText('game.loadingCard.description')).toBeInTheDocument()
    const loadingImg = images.find(x => x.id === 'loading')
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.src).toBe(loadingImg.urlImage)
    expect(container.querySelector('.book-page-content')).not.toBeNull()
  })

  it('spins the page-loading spinner over the image', () => {
    const { container } = render(<LoadingCard />)
    expect(container.querySelector('.book-page-loading .fa-spinner')).not.toBeNull()
  })

  it('credits the photo author from data/images.json', () => {
    const loadingImg = images.find(x => x.id === 'loading')
    render(<LoadingCard />)
    expect(screen.getByText(new RegExp(loadingImg.copyrightText))).toBeInTheDocument()
  })

  it('takes the picture, credits and description from the story card when given', () => {
    const story = { card: {
      title: 'My Story', description: 'A tale of paths',
      urlImage: 'http://story/cover.jpg',
      copyrightText: 'Story Author', linkCopyright: 'http://story/credit',
    } }
    const { container } = render(<LoadingCard story={story} />)
    // the title stays the "Loading…" one; image + description come from the story
    expect(screen.getByText('game.loadingCard.title')).toBeInTheDocument()
    expect(screen.queryByText('game.loadingCard.description')).toBeNull()
    expect(screen.getByText('A tale of paths')).toBeInTheDocument()
    expect(container.querySelector('img').src).toBe('http://story/cover.jpg')
    // the credits follow the image: the story author, not the fixed photo's one
    expect(screen.getByText(/Story Author/)).toBeInTheDocument()
    const loadingImg = images.find(x => x.id === 'loading')
    expect(screen.queryByText(new RegExp(loadingImg.copyrightText))).toBeNull()
  })

  it('keeps the fixed picture and description when the story card lacks them', () => {
    const { container } = render(<LoadingCard story={{ card: { title: 'Bare' } }} />)
    const loadingImg = images.find(x => x.id === 'loading')
    expect(container.querySelector('img').src).toBe(loadingImg.urlImage)
    expect(screen.getByText('game.loadingCard.description')).toBeInTheDocument()
  })

  it('caps and centers the card when maxWidth is given, fills the space otherwise', () => {
    const { container } = render(<LoadingCard maxWidth="300px" />)
    const wrap = container.firstChild
    expect(wrap.style.maxWidth).toBe('300px')
    expect(wrap.style.margin).toBe('0px auto')
    expect(wrap.querySelector('.book-page-content')).not.toBeNull()
    // without maxWidth there is no wrapper: the page card is the root element
    const { container: bare } = render(<LoadingCard />)
    expect(bare.firstChild.className).toContain('book-page-content')
  })
})

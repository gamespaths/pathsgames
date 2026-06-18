import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import CardImage from '../components/layout/CardImage'

describe('CardImage', () => {
  it('renders an img with src/alt/class when a source is given', () => {
    const { container } = render(
      <CardImage src="http://x/i.png" alt="hero" imgClassName="gc-img big" />
    )
    const img = container.querySelector('img')
    expect(img.getAttribute('src')).toBe('http://x/i.png')
    expect(img.getAttribute('alt')).toBe('hero')
    expect(img.className).toBe('gc-img big')
  })

  it('renders the icon placeholder when no source', () => {
    const { container } = render(<CardImage placeholderIcon="fas fa-star" />)
    expect(container.querySelector('.gc-placeholder .fa-star')).toBeTruthy()
  })

  it('renders nothing when no source and renderPlaceholder is false', () => {
    const { container } = render(<CardImage renderPlaceholder={false} />)
    expect(container.firstChild).toBeNull()
  })
})

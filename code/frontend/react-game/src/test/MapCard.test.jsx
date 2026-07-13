import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

import MapCard from '../features/gameplay/cards/MapCard'
import images from '@/data/images.json'

describe('MapCard', () => {
  it('renders the map title and the image from data/images.json (id "map")', () => {
    render(<MapCard onOpen={vi.fn()} />)
    expect(screen.getByText('game.map.title')).toBeInTheDocument()
    const mapImg = images.find(x => x.id === 'map')
    const img = document.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.src).toBe(mapImg.urlImage)
  })

  it('shows the footer action button that opens the map', async () => {
    const onOpen = vi.fn()
    render(<MapCard onOpen={onOpen} />)
    const btn = screen.getByRole('button', { name: /game\.map\.open/ })
    fireEvent.click(btn)
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1))
  })

  it('has no select button and no (i) preview button', () => {
    render(<MapCard onOpen={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'card.info' })).toBeNull()
    expect(screen.queryByRole('button', { name: /select/i })).toBeNull()
  })
})

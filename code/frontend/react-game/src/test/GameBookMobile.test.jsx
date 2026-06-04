import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '../i18n/context'

// Isolate GameBookMobile from its (already separately tested) children.
vi.mock('../features/game/SelectionView', () => ({ default: () => <div data-testid="selection" /> }))
vi.mock('../features/game/PlayerStats', () => ({ default: () => <div data-testid="stats" /> }))
vi.mock('../components/book/BookPageContent', () => ({ default: () => <div data-testid="page" /> }))

import GameBookMobile from '../features/game/GameBookMobile'

const wrap = (ui) => render(<LanguageProvider>{ui}</LanguageProvider>)

describe('GameBookMobile', () => {
  it('renders the story-card branch when there are no locations', () => {
    const story = { title: 'Quest', description: 'desc', card: { urlImage: 'http://x/a.png', title: 'Quest', description: 'desc' } }
    const gameData = { startLocation: null, playerStats: {}, locations: [], actions: [] }
    wrap(<GameBookMobile gameData={gameData} story={story} onEndGame={vi.fn()} />)
    expect(screen.getByText('Quest')).toBeInTheDocument()
    expect(screen.getByTestId('stats')).toBeInTheDocument()
  })

  it('renders the current-location card and neighbours when locations exist', () => {
    const gameData = {
      startLocation: { name: 'Cave', description: 'dark', urlImage: 'http://x/c.png' },
      playerStats: {},
      locations: [{ uuid: 'l1', name: 'Cave' }],
      actions: [],
    }
    wrap(<GameBookMobile gameData={gameData} story={{ card: {} }} onEndGame={vi.fn()} />)
    expect(screen.getByText('Cave')).toBeInTheDocument()
    // two SelectionView instances (neighbours + actions)
    expect(screen.getAllByTestId('selection').length).toBe(2)
  })

  it('shows the end error when provided', () => {
    const gameData = { startLocation: null, playerStats: {}, locations: [], actions: [] }
    wrap(<GameBookMobile gameData={gameData} story={{ card: { title: 'T' } }} onEndGame={vi.fn()} endError="boom" />)
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('handles missing gameData without crashing', () => {
    wrap(<GameBookMobile story={null} onEndGame={vi.fn()} />)
    expect(screen.getByTestId('stats')).toBeInTheDocument()
  })
})

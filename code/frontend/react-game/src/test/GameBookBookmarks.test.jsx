import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { accessToken: 'tok' } }),
}))
vi.mock('../api/matches', () => ({
  endMatch: vi.fn(),
  getMatchClock: vi.fn(() => Promise.resolve(null)),
  getMatchWeather: vi.fn(() => Promise.resolve(null)),
  getMatchLocations: vi.fn(() => Promise.resolve({ matchUuid: 'm1', locations: [] })),
  sleepCharacter: vi.fn(),
  startMovement: vi.fn(),
  executeEvent: vi.fn(),
}))
// The real tabs, so a click travels the same path a player's would; the pages themselves
// stay as flat markers.
vi.mock('../components/book/Book', async () => {
  const { default: BookBookmarks } = await import('../components/book/BookBookmarks')
  return {
    default: ({ left, right, bookmarksLeft, bookmarksRight }) => (
      <div data-testid="book">
        <BookBookmarks items={bookmarksLeft} side="left" />
        <BookBookmarks items={bookmarksRight} side="right" />
        {left}{right}
      </div>
    ),
  }
})
vi.mock('../components/book/BookPageLeft', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../components/book/BookPageRight', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../features/gameplay/cards/LocationCard', () => ({ default: () => <div data-testid="location-card" /> }))
vi.mock('../features/gameplay/cards/PlayerStats', () => ({ default: () => <div data-testid="player-stats" /> }))
vi.mock('../features/gameplay/ClockWidget', () => ({ default: () => <div data-testid="clock-widget" /> }))
vi.mock('../features/gameplay/SleepButton', () => ({ default: () => <div data-testid="sleep-button" /> }))
vi.mock('../features/gameplay/EndGameBook', () => ({ default: () => <div data-testid="end-game-book" /> }))
vi.mock('../features/gameplay/GameBookMobile', () => ({ default: () => <div data-testid="game-book-mobile" /> }))
vi.mock('@/components/layout/Map', () => ({
  default: ({ onClose }) => (
    <div data-testid="map-page"><button data-testid="map-back" onClick={onClose}>back</button></div>
  ),
}))
vi.mock('../features/gameplay/cards/ItemsCards', () => ({ default: () => <div data-testid="items-cards" /> }))

import GameBook from '../features/gameplay/GameBook'

const GAME_DATA = {
  actualLocationCard: { name: 'Entrance', title: 'Entrance' },
  playerStats: { life: 3, lifeMax: 10, energy: 2, energyMax: 8, sadness: 1, sadnessMax: 5, weight: 7, weightMax: 30 },
  locations: [],
  actions: [],
  info: { locationsActive: [] },
}
const STORY = { uuid: 's1', title: 'Test Story', card: { title: 'Test Story' } }

function renderBook() {
  return render(<GameBook gameData={GAME_DATA} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
}

describe('GameBook — the book bookmarks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hangs the five tabs on the left page; the right row is empty for now', () => {
    const { container } = renderBook()

    expect(container.querySelectorAll('.book-bookmarks--left .book-bookmark').length).toBe(5)
    // Multiplayer is commented out in GameBook: an empty row renders nothing at all.
    expect(container.querySelector('.book-bookmarks--right')).toBeNull()

    const missions = screen.getByLabelText('game.bookmarks.missions')
    expect(missions).toHaveClass('is-disabled')
    expect(missions).toHaveAttribute('title', 'game.bookmarks.comingSoon')
  })

  it('prints no words: a tab is its icon and its badges', () => {
    renderBook()
    expect(screen.getByLabelText('game.bookmarks.map').textContent).toBe('')
    expect(screen.queryByText('game.bookmarks.information')).toBeNull()
  })

  it('reads the board without opening it: life/energy/sadness on (i), the load on the bag', () => {
    renderBook()

    const info = screen.getByLabelText('game.bookmarks.information')
    expect(info.textContent).toContain('3/10')
    expect(info.textContent).toContain('2/8')
    expect(info.textContent).toContain('1/5')
    expect(screen.getByLabelText('game.bookmarks.backpack').textContent).toContain('7/30')
  })

  it('falls back to 0/0 on the bag when no weight is projected yet', () => {
    render(<GameBook gameData={{ ...GAME_DATA, playerStats: {} }} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.getByLabelText('game.bookmarks.backpack').textContent).toContain('0/0')
  })

  it('the map tab opens the map page and then goes inert', () => {
    renderBook()
    fireEvent.click(screen.getByLabelText('game.bookmarks.map'))

    expect(screen.getByTestId('map-page')).toBeInTheDocument()
    expect(screen.getByLabelText('game.bookmarks.map')).toHaveClass('is-active')
  })

  it('the backpack tab opens the bag page and then goes inert', () => {
    renderBook()
    fireEvent.click(screen.getByLabelText('game.bookmarks.backpack'))

    expect(screen.getByTestId('items-cards')).toBeInTheDocument()
    expect(screen.getByLabelText('game.bookmarks.backpack')).toHaveClass('is-active')
  })

  it('the (i) tab opens the same information view the card lens opens', () => {
    const { container } = renderBook()
    fireEvent.click(screen.getByLabelText('game.bookmarks.information'))

    // The information page took the left page over — its badge rows are the giveaway.
    expect(container.querySelector('.information-card-rows')).toBeInTheDocument()
    expect(screen.getByLabelText('game.bookmarks.information')).toHaveClass('is-active')
  })

  it('the tabs are exclusive: opening one puts the page another left open away', () => {
    const { container } = renderBook()

    fireEvent.click(screen.getByLabelText('game.bookmarks.information'))
    fireEvent.click(screen.getByLabelText('game.bookmarks.map'))

    // The map took the page; the information one is gone, not merely covered.
    expect(screen.getByTestId('map-page')).toBeInTheDocument()
    expect(container.querySelector('.information-card-rows')).toBeNull()
    expect(screen.getByLabelText('game.bookmarks.information')).not.toHaveClass('is-active')

    fireEvent.click(screen.getByLabelText('game.bookmarks.backpack'))
    expect(screen.queryByTestId('map-page')).toBeNull()
    expect(screen.getByTestId('items-cards')).toBeInTheDocument()
  })

  it('whichever tab is open, back lands on the board', () => {
    const { container } = renderBook()

    for (const key of ['information', 'map', 'backpack']) {
      fireEvent.click(screen.getByLabelText(`game.bookmarks.${key}`))
      // The map page owns its back button; the other two are reading pages, whose arrow
      // Card labels card.back.
      if (key === 'map') fireEvent.click(screen.getByTestId('map-back'))
      else fireEvent.click(screen.getAllByLabelText('card.back')[0])

      expect(screen.queryByTestId('map-page')).toBeNull()
      expect(screen.queryByTestId('items-cards')).toBeNull()
      expect(container.querySelector('.information-card-rows')).toBeNull()
      // The board is back: the current location owns the left page again, and the only lit
      // tab is the position one — which IS the board.
      expect(screen.getByTestId('location-card')).toBeInTheDocument()
      expect(container.querySelectorAll('.book-bookmark.is-active').length).toBe(1)
      expect(screen.getByLabelText('game.bookmarks.position')).toHaveClass('is-active')
    }
  })

  it('paints the (i) tab red when a statistic is about to run out', () => {
    for (const stats of [
      { ...GAME_DATA.playerStats, life: 1 },
      { ...GAME_DATA.playerStats, energy: 1 },
      { ...GAME_DATA.playerStats, sadness: 5, sadnessMax: 5 },
    ]) {
      const { unmount } = render(<GameBook gameData={{ ...GAME_DATA, playerStats: stats }}
        matchUuid="m1" story={STORY} onClose={vi.fn()} />)
      expect(screen.getByLabelText('game.bookmarks.information')).toHaveClass('is-danger')
      unmount()
    }
  })

  it('leaves both tabs calm while the character is fine', () => {
    renderBook()
    expect(screen.getByLabelText('game.bookmarks.information')).not.toHaveClass('is-danger')
    expect(screen.getByLabelText('game.bookmarks.backpack')).not.toHaveClass('is-danger')
  })

  it('paints the bag tab red only PAST the limit, not at it', () => {
    const bagWith = weight => ({ ...GAME_DATA, playerStats: { ...GAME_DATA.playerStats, weight, weightMax: 30 } })

    const { unmount } = render(<GameBook gameData={bagWith(30)} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.getByLabelText('game.bookmarks.backpack')).not.toHaveClass('is-danger')
    unmount()

    render(<GameBook gameData={bagWith(31)} matchUuid="m1" story={STORY} onClose={vi.fn()} />)
    expect(screen.getByLabelText('game.bookmarks.backpack')).toHaveClass('is-danger')
  })

  describe('the position tab', () => {
    it('is the pin alone: the page it returns to names the location in full', () => {
      renderBook()
      expect(screen.getByLabelText('game.bookmarks.position').textContent).toBe('')
    })

    it('is lit and inert while the board is what is already showing', () => {
      renderBook()
      const tab = screen.getByLabelText('game.bookmarks.position')

      expect(tab).toHaveClass('is-active')
      fireEvent.click(tab)
      expect(screen.getByTestId('location-card')).toBeInTheDocument()
    })

    it('brings any open page back to the board', () => {
      const { container } = renderBook()

      fireEvent.click(screen.getByLabelText('game.bookmarks.map'))
      fireEvent.click(screen.getByLabelText('game.bookmarks.position'))

      expect(screen.queryByTestId('map-page')).toBeNull()
      expect(screen.getByTestId('location-card')).toBeInTheDocument()
      expect(container.querySelector('.information-card-rows')).toBeNull()
    })

    it('is there even before a location card is loaded', () => {
      render(<GameBook gameData={{ ...GAME_DATA, actualLocationCard: null }}
        matchUuid="m1" story={STORY} onClose={vi.fn()} />)
      expect(screen.getByLabelText('game.bookmarks.position')).toBeInTheDocument()
    })
  })
})

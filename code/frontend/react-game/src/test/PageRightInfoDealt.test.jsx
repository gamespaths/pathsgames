import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))
const { stub } = vi.hoisted(() => ({ stub: name => ({ default: () => <div className="pg-card" data-testid={name} /> }) }))
vi.mock('../features/gameplay/cards/WeatherCard', () => stub('weather'))
vi.mock('../features/gameplay/cards/GoToSleepCard', () => stub('sleep'))
vi.mock('../features/gameplay/cards/MapCard', () => stub('map'))
vi.mock('../features/gameplay/cards/ItemsCard', () => stub('items'))
vi.mock('../features/gameplay/cards/RegistryCard', () => stub('registry'))
vi.mock('../features/gameplay/cards/MissionCard', () => stub('missions'))
vi.mock('../features/gameplay/cards/PlayerCards', () => stub('player'))

import PageRightInfo from '../features/gameplay/PageRightInfo'

// Step 14 — every card grid is a DealtList: its cards are dealt from the deck.
describe('PageRightInfo — dealt grid (step 14)', () => {
  it('the (i) view list carries pg-dealt and its cards are landed at once without an observer', () => {
    const { container } = render(<PageRightInfo story={{}} storyFull={{}} gameData={{}} playerStats={{}} />)
    const list = container.querySelector('.config-cards-area.selection-list.pg-dealt')
    expect(list).toBeInTheDocument()
    expect(list.querySelectorAll(':scope > .pg-card[data-deal="landed"]')).toHaveLength(7)
  })
})

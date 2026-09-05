import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import LocationStateCard from '../../components/match/detail/LocationStateCard'
import MatchLogsCard from '../../components/match/detail/MatchLogsCard'
import MatchConfigCard from '../../components/match/detail/MatchConfigCard'
import RegistryCard from '../../components/match/detail/RegistryCard'

/**
 * The admin match-detail cards render whatever the API sends, and the API omits
 * plenty: a location with no counter, a neighbour with no cost breakdown, a log
 * entry of a type the console does not know yet. This suite feeds each card the
 * sparse shapes, which is where every `?? fallback` in them lives.
 */

const COLORS = { border: '#7f1d1d', bg: '#2a1a1a' }

describe('LocationStateCard with sparse data', () => {
  const name20 = (id) => (id ? `Loc ${id}` : '—')
  const templateName = (uuid) => `T:${uuid}`

  it('renders the empty-table row when info carries no locations at all', () => {
    render(<LocationStateCard
      info={{}}
      players={undefined}
      movementByLoc={new Map()}
      locationName20={name20}
      templateName={templateName} />)

    expect(screen.getByText(/gaming_state_locations \(0\)/)).toBeInTheDocument()
    expect(screen.getByText('No locations.')).toBeInTheDocument()
  })

  it('falls back on every optional column of a bare location row', () => {
    render(<LocationStateCard
      info={{ locations: [{ idLocation: 5 }] }}   // no uuid, no flags, no counter
      players={undefined}
      movementByLoc={new Map()}
      locationName20={name20}
      templateName={templateName} />)

    const row = screen.getByText('#5').closest('tr')
    const cells = within(row).getAllByRole('cell')
    expect(cells[3]).toHaveTextContent('—')   // nobody inside
    expect(cells[4]).toHaveTextContent('—')   // hence no neighbours
    expect(cells[5]).toHaveTextContent('no')  // flagAlreadyActived absent
    expect(cells[6]).toHaveTextContent('no')  // flagVisited absent
    expect(cells[7]).toHaveTextContent('0')   // clockCounter absent
  })

  it('prices a neighbour with no cost fields as zero and flags a locked move', () => {
    const movementByLoc = new Map([[5, {
      uuid: 'loc-5',
      neighbors: [{ idLocation: 6, uuid: 'loc-6', conditionMet: false }],
    }]])

    render(<LocationStateCard
      info={{ locations: [{ uuid: 'loc-5', idLocation: 5, flagAlreadyActived: 1, flagVisited: 1, clockCounter: 3 }] }}
      players={[{ uuid: 'p1', idLocation: 5, characterTemplateUuid: 'tpl-1' }]}
      movementByLoc={movementByLoc}
      locationName20={name20}
      templateName={templateName} />)

    const row = screen.getByText('#5').closest('tr')
    expect(within(row).getByText('T:tpl-1')).toBeInTheDocument()
    expect(row).toHaveTextContent('— · Loc 6')        // direction missing
    expect(row).toHaveTextContent('(0 + 0 + 0 =')     // every cost missing
    expect(within(row).getByTitle('movement condition not met')).toBeInTheDocument()
    const cells = within(row).getAllByRole('cell')
    expect(cells[5]).toHaveTextContent('yes')
    expect(cells[6]).toHaveTextContent('yes')
    expect(cells[7]).toHaveTextContent('3')
  })
})

describe('MatchLogsCard with sparse data', () => {
  it('renders nothing at all when the endpoint gave no entries', () => {
    const { container } = render(<MatchLogsCard entries={null} currentClock={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('counts a single entry in the singular and defaults the total to what is shown', () => {
    render(<MatchLogsCard entries={[{ type: 'SLEEP', clock: 1 }]} currentClock={4} />)

    expect(screen.getByText(/\(1 of 1 entry · clock 4\)/)).toBeInTheDocument()
    expect(screen.getByText(/Showing 1 of 1/)).toBeInTheDocument()
  })

  it('renders a card thumbnail fallback, an untitled card and a uuid-only character', () => {
    render(<MatchLogsCard
      currentClock={2}
      entries={[
        { type: 'WEATHER', clock: 1, card: { awesomeIcon: null }, characterUuid: 'char-1' },
        { type: 'MOVEMENT', clock: 1, card: { urlImage: 'x.png' }, characterName: 'Rogue' },
      ]} />)

    const cards = screen.getAllByTestId('log-card')
    expect(within(cards[0]).getByText('untitled')).toBeInTheDocument()
    expect(cards[1].querySelector('img')).toHaveAttribute('alt', '')
    expect(screen.getByTitle('char-1')).toHaveTextContent('char-1')
    expect(screen.getByText('Rogue')).toBeInTheDocument()
  })

  it('renders a dash for every detail an entry does not carry, and for unknown types', () => {
    render(<MatchLogsCard
      currentClock={9}
      total={12}
      entries={[
        { type: 'WEATHER' },            // no idWeather
        { type: 'MOVEMENT' },           // neither endpoint nor cost
        { type: 'RECOVERY' },           // no message
        { type: 'EVENT' },              // no idEvent
        { type: 'SOMETHING_NEW' },      // a type this console predates
      ]} />)

    expect(screen.getByText('? → ?')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument()
    expect(screen.getByText(/\(5 of 12 entries · clock 9\)/)).toBeInTheDocument()
  })
})

describe('MatchConfigCard and RegistryCard with sparse data', () => {
  it('MatchConfigCard dashes out an unknown status, story and location', () => {
    render(<MatchConfigCard
      match={{}}
      info={{}}
      status={null}
      colors={COLORS}
      isTerminalStatus
      actionLoading={false}
      actionError={null}
      difficultyName={() => null}
      rngSeed={null}
      locationName20={() => null}
      onPause={vi.fn()} onResume={vi.fn()} onStop={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByTestId('match-status-label')).toHaveTextContent('—')
    expect(screen.getAllByText('—').length).toBeGreaterThan(1)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0) // currentClock/expCost default
  })

  it('RegistryCard renders the empty state and dashes a row with no int value', () => {
    const { rerender } = render(<RegistryCard registry={undefined} />)
    expect(screen.getByText('No registry entries.')).toBeInTheDocument()
    expect(screen.getByText(/Registry \(0\)/)).toBeInTheDocument()

    // Step 36.1 — a key whose set is empty dashes out; the multi column still answers.
    rerender(<RegistryCard registry={[{ key: 'gate' }]} />)
    const row = screen.getByText('gate').closest('tr')
    expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('—')
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('no')
  })
})

describe('MatchLogsCard — the detail column of every row type', () => {
  const row = (entry) => render(<MatchLogsCard entries={[{ clock: 1, ...entry }]} currentClock={1} />)

  it('a counter-zero row names the location it happened in', () => {
    row({ type: 'COUNTER_ZERO', idLocationTo: 7 })
    expect(screen.getByText('location #7')).toBeInTheDocument()
  })

  it('a counter-zero row with no location reads as a dash', () => {
    row({ type: 'COUNTER_ZERO' })
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('an item row with no item id says so rather than inventing one', () => {
    row({ type: 'ITEM_USE' })
    expect(screen.getByText('item ?')).toBeInTheDocument()
  })

  it('an item row names the item, its count and the event behind it', () => {
    row({ type: 'ITEM_ADD', idItem: 3, counter: 2, idEvent: 9 })
    expect(screen.getByText('item #3 ×2 (event #9)')).toBeInTheDocument()
  })

  it('a row of a type the console does not know yet still renders', () => {
    row({ type: 'SOMETHING_NEW' })
    expect(screen.getByText(/Showing 1 of 1/)).toBeInTheDocument()
  })
})

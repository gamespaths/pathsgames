// v0.41.1 Step 41 A — the five new timeline types in the admin log, and the admin info logCount.
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MatchLogsCard from '../../components/match/detail/MatchLogsCard'

const ENTRIES = [
  { type: 'MATCH_LIFECYCLE', clock: 0, message: 'CREATED' },
  { type: 'PASS', clock: 0, characterUuid: 'c1' },
  { type: 'EDGE_STATE', clock: 0, message: 'COMA', characterUuid: 'c1' },
  { type: 'TRAIT_CHANGE', clock: 0, message: 'ADD trait-1', idEvent: 10 },
  { type: 'ADMIN_ACTION', clock: 0, message: 'STATS energy=7' },
  { type: 'ADMIN_ACTION', clock: 1 },
]

describe('MatchLogsCard Step 41 types', () => {
  it('gives each new type its badge and detail', () => {
    render(<MatchLogsCard currentClock={1} total={6} entries={ENTRIES} />)
    for (const type of ['MATCH_LIFECYCLE', 'PASS', 'EDGE_STATE', 'TRAIT_CHANGE', 'ADMIN_ACTION']) {
      expect(screen.getAllByText(type).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('CREATED')).toBeInTheDocument()
    expect(screen.getByText('turn passed')).toBeInTheDocument()
    expect(screen.getByText('COMA')).toBeInTheDocument()
    expect(screen.getByText('ADD trait-1')).toBeInTheDocument()
    expect(screen.getByText('STATS energy=7')).toBeInTheDocument()
    expect(document.querySelector('.fa-user-shield')).toBeInTheDocument()
    expect(document.querySelector('.fa-heart-pulse')).toBeInTheDocument()
  })

  it('each new type has a filter chip of its own', () => {
    render(<MatchLogsCard currentClock={1} total={6} entries={ENTRIES} />)
    fireEvent.click(screen.getByTitle('ADMIN_ACTION'))
    expect(screen.queryByText('turn passed')).not.toBeInTheDocument()
    expect(screen.getByText('STATS energy=7')).toBeInTheDocument()
  })

  it('shows the stored log rows when the admin info carries them', () => {
    const { rerender } = render(<MatchLogsCard currentClock={1} total={6} entries={ENTRIES} logCount={42} />)
    expect(screen.getByTestId('match-logs-count')).toHaveTextContent('42 log rows')
    rerender(<MatchLogsCard currentClock={1} total={6} entries={ENTRIES} />)
    expect(screen.queryByTestId('match-logs-count')).not.toBeInTheDocument()
  })
})

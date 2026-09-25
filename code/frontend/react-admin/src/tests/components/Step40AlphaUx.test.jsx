import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EnvBadge, { envBadgeLabel } from '../../components/layout/EnvBadge'
import MatchLogsCard from '../../components/match/detail/MatchLogsCard'

// Step 40 — the environment badge and the CHOICE timeline entry.

describe('EnvBadge (react-admin)', () => {
  it('maps the env code to an English label', () => {
    expect(envBadgeLabel('dev')).toBe('Local')
    expect(envBadgeLabel(' TEST ')).toBe('Test')
    expect(envBadgeLabel('alpha')).toBe('Alpha')
    expect(envBadgeLabel('beta')).toBe('Beta')
    expect(envBadgeLabel('gamma')).toBe('GAMMA')
    expect(envBadgeLabel('')).toBeNull()
    expect(envBadgeLabel('prod')).toBeNull()
    expect(envBadgeLabel(null)).toBeNull()
  })

  it('renders the label, or nothing', () => {
    const { rerender, container } = render(<EnvBadge code="dev" />)
    expect(screen.getByTestId('env-badge')).toHaveTextContent('Local')
    rerender(<EnvBadge code="prod" />)
    expect(container.firstChild).toBeNull()
    rerender(<EnvBadge />)
    expect(container.firstChild).toBeNull()
  })
})

describe('MatchLogsCard CHOICE entries', () => {
  it('has its own badge and names the owning event, with its gains', () => {
    render(<MatchLogsCard currentClock={3}
      entries={[{ type: 'CHOICE', clock: 3, idEvent: 32, foodGain: 2, coinGain: 1 }]} />)
    expect(screen.getAllByText('CHOICE').length).toBeGreaterThan(0)
    expect(screen.getByText('choice of event #32')).toBeInTheDocument()
  })

  it('a CHOICE with no event reads as a dash', () => {
    render(<MatchLogsCard currentClock={3} entries={[{ type: 'CHOICE', clock: 3 }]} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

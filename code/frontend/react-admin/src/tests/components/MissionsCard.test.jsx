import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import MissionsCard from '../../components/match/detail/MissionsCard'

const ACTIVE = {
  uuid: 'm-1', name: 'The cartographer', description: 'Walk every path',
  status: 'ACTIVE', stepReached: 2, stepsTotal: 3,
  steps: [
    { uuid: 's-1', step: 1, name: 'Hills', done: true },
    { uuid: 's-2', step: 2, name: 'Mountains', done: true },
    { uuid: 's-3', step: 3, name: 'Peaks', done: false },
  ],
}
// A mission with no steps: its own condition is the completion condition.
const FLAT = { uuid: 'm-2', name: 'A rest', status: 'COMPLETED', stepsTotal: 0, steps: [] }

describe('MissionsCard', () => {
  it('lists every mission with its status and step progress', () => {
    render(<MissionsCard missions={[ACTIVE, FLAT]} />)
    expect(screen.getByText('The cartographer')).toBeInTheDocument()
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    // No steps at all leaves nothing to count.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByText('Walk every path')).toBeInTheDocument()
  })

  it('counts the statuses in the header', () => {
    render(<MissionsCard missions={[ACTIVE, FLAT]} />)
    expect(screen.getByText(/Missions \(2\)/)).toBeInTheDocument()
    expect(screen.getByText(/1 active · 1 completed/)).toBeInTheDocument()
  })

  it('unfolds and folds the steps, marking the closed ones', async () => {
    const user = userEvent.setup()
    render(<MissionsCard missions={[ACTIVE]} />)
    expect(screen.queryByText('1. Hills')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Steps of The cartographer'))
    expect(screen.getByText('1. Hills')).toBeInTheDocument()
    expect(screen.getByText('3. Peaks')).toBeInTheDocument()
    expect(screen.getAllByTitle('closed')).toHaveLength(2)
    expect(screen.getByTitle('still open')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Steps of The cartographer'))
    expect(screen.queryByText('1. Hills')).not.toBeInTheDocument()
  })

  it('offers no toggle for a mission without steps', () => {
    render(<MissionsCard missions={[FLAT]} />)
    expect(screen.queryByLabelText('Steps of A rest')).not.toBeInTheDocument()
  })

  it('counts nothing closed when a row arrives without its steps', async () => {
    const user = userEvent.setup()
    render(<MissionsCard missions={[{ uuid: 'm-5', name: 'Headless', status: 'ACTIVE', stepsTotal: 2 }]} />)
    expect(screen.getByText('0 / 2')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Steps of Headless'))
    expect(screen.getByText('Headless')).toBeInTheDocument()
  })

  it('says a match reached no mission rather than that none is authored', () => {
    render(<MissionsCard missions={[]} />)
    expect(screen.getByText('No mission reached by this match.')).toBeInTheDocument()
  })

  it('tolerates a missing payload and the sparse fields of one row', () => {
    render(<MissionsCard />)
    expect(screen.getByText(/Missions \(0\)/)).toBeInTheDocument()
    render(<MissionsCard missions={[{ uuid: 'm-3', stepsTotal: 1, steps: [{ uuid: 's-9' }] }]} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('unfolds a step row that carries no number and no name', async () => {
    const user = userEvent.setup()
    render(<MissionsCard missions={[{ uuid: 'm-4', stepsTotal: 1, steps: [{ uuid: 's-9' }] }]} />)
    await user.click(screen.getByLabelText('Steps of m-4'))
    expect(screen.getByText('s-9')).toBeInTheDocument()
  })
})

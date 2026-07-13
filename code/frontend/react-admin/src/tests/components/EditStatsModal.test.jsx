import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const changePlayerStatistics = vi.fn()
vi.mock('../../api/matchApi', () => ({
  changePlayerStatistics: (...args) => changePlayerStatistics(...args),
}))

import EditStatsModal from '../../components/match/detail/EditStatsModal'

/** A character the engine has knocked out: in a coma, hence also asleep, with no life left. */
const COMATOSE = {
  uuid: 'c1', dexterity: 3, intelligence: 3, constitution: 3,
  energy: 0, energyMax: 10, life: 0, lifeMax: 12, sad: 2, sadMax: 8,
  coin: 5, food: 1, magic: 0, isSleeping: true, isComa: true,
}

describe('EditStatsModal — state flags', () => {
  beforeEach(() => {
    changePlayerStatistics.mockReset()
    changePlayerStatistics.mockResolvedValue({ status: 'UPDATED' })
  })

  function open(player = COMATOSE) {
    render(<EditStatsModal matchUuid="m1" player={player} onClose={vi.fn()} onSaved={vi.fn()} />)
  }

  it('reflects the character current flags', () => {
    open()
    expect(screen.getByTestId('stats-coma')).toBeChecked()
    expect(screen.getByTestId('stats-sleeping')).toBeChecked()
  })

  it('sends coma=false when the admin clears it, and warns about what that implies', () => {
    open()
    fireEvent.click(screen.getByTestId('stats-coma'))

    expect(screen.getByText(/raises Life to at least 1/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Save'))
    const [, , body] = changePlayerStatistics.mock.calls[0]
    expect(body.coma).toBe(false)
  })

  it('leaves the flags on when the admin only edits the numbers', async () => {
    open()
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(changePlayerStatistics).toHaveBeenCalled())
    const [matchUuid, playerUuid, body] = changePlayerStatistics.mock.calls[0]
    expect(matchUuid).toBe('m1')
    expect(playerUuid).toBe('c1')
    expect(body.coma).toBe(true)
    expect(body.sleeping).toBe(true)
  })

  it('can put a healthy character to sleep', () => {
    open({ ...COMATOSE, isComa: false, isSleeping: false, life: 10 })
    expect(screen.getByTestId('stats-coma')).not.toBeChecked()
    fireEvent.click(screen.getByTestId('stats-sleeping'))
    fireEvent.click(screen.getByText('Save'))
    const [, , body] = changePlayerStatistics.mock.calls[0]
    expect(body.sleeping).toBe(true)
    expect(body.coma).toBe(false)
  })
})

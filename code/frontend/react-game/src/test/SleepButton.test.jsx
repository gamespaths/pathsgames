import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

vi.mock('../api/matches', () => ({
  sleepCharacter: vi.fn(),
}))

import { sleepCharacter } from '../api/matches'
import SleepButton from '../features/gameplay/SleepButton'

describe('SleepButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show the confirm dialog until the button is clicked', () => {
    render(<SleepButton matchUuid="m1" accessToken="tok" />)
    expect(screen.queryByText('game.sleep.confirmBody')).not.toBeInTheDocument()
  })

  it('opens the confirm dialog when the button is clicked', () => {
    render(<SleepButton matchUuid="m1" accessToken="tok" />)
    fireEvent.click(screen.getByText('game.sleep.action'))
    expect(screen.getByText('game.sleep.confirmBody')).toBeInTheDocument()
  })

  it('calls sleepCharacter on confirm and invokes onSlept with the result', async () => {
    const result = { matchUuid: 'm1', isSleeping: true, timeEndTriggered: true, currentClock: 1 }
    sleepCharacter.mockResolvedValue(result)
    const onSlept = vi.fn()
    render(<SleepButton matchUuid="m1" accessToken="tok" onSlept={onSlept} />)

    fireEvent.click(screen.getByText('game.sleep.action'))
    fireEvent.click(screen.getByText('game.sleep.confirm'))

    await waitFor(() => expect(sleepCharacter).toHaveBeenCalledWith('m1', 'tok'))
    await waitFor(() => expect(onSlept).toHaveBeenCalledWith(result))
    // dialog closes on success
    await waitFor(() => expect(screen.queryByText('game.sleep.confirmBody')).not.toBeInTheDocument())
  })

  it('is disabled when the character is already sleeping', () => {
    render(<SleepButton matchUuid="m1" accessToken="tok" disabled />)
    expect(screen.getByText('game.sleep.action').closest('button')).toBeDisabled()
  })

  it('surfaces the backend error code on a 409 and keeps the dialog open', async () => {
    sleepCharacter.mockRejectedValue({ response: { data: { error: 'ALREADY_SLEEPING' } } })
    const onSlept = vi.fn()
    render(<SleepButton matchUuid="m1" accessToken="tok" onSlept={onSlept} />)

    fireEvent.click(screen.getByText('game.sleep.action'))
    fireEvent.click(screen.getByText('game.sleep.confirm'))

    await waitFor(() => expect(screen.getByText('ALREADY_SLEEPING')).toBeInTheDocument())
    expect(onSlept).not.toHaveBeenCalled()
  })
})

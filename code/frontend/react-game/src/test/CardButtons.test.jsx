import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

import CardButtons from '../components/layout/CardButtons'

describe('CardButtons action spinner', () => {
  it('shows the in-progress spinner while the action runs, then clears it once it settles', async () => {
    // A pending action: the spinner must show; on resolve the button must return.
    let resolve
    const onAction = vi.fn(() => new Promise(r => { resolve = r }))
    render(<CardButtons name="Sleep" onAction={onAction} actionLabel="sleep-now" />)

    fireEvent.click(screen.getByText('sleep-now'))
    expect(onAction).toHaveBeenCalled()
    // While the promise is pending, the action button is replaced by the spinner.
    expect(screen.getByText('card.actionInProgress')).toBeInTheDocument()
    expect(screen.queryByText('sleep-now')).not.toBeInTheDocument()

    // Settling the action must clear the spinner and restore the action button —
    // otherwise a card that stays mounted (e.g. GoToSleepCard at energy <= 1)
    // would spin forever.
    resolve()
    await waitFor(() => expect(screen.queryByText('card.actionInProgress')).not.toBeInTheDocument())
    expect(screen.getByText('sleep-now')).toBeInTheDocument()
  })

  it('clears the spinner even when the action rejects', async () => {
    const onAction = vi.fn(() => Promise.reject(new Error('boom')))
    render(<CardButtons name="Sleep" onAction={onAction} actionLabel="sleep-now" />)

    fireEvent.click(screen.getByText('sleep-now'))
    await waitFor(() => expect(screen.getByText('sleep-now')).toBeInTheDocument())
    expect(screen.queryByText('card.actionInProgress')).not.toBeInTheDocument()
  })
})

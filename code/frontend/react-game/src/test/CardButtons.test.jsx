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

describe('CardButtons actionsList', () => {
  it('renders one button per entry, in order, after the main action', () => {
    render(
      <CardButtons name="Stats" onAction={vi.fn()} actionLabel="map" actionIcon="fa-map"
        actionsList={[
          { label: 'bag', icon: 'fa-suitcase', onAction: vi.fn() },
          { label: 'quests', icon: 'fa-scroll', onAction: vi.fn() },
        ]} />
    )
    const labels = [...document.querySelectorAll('.gc-footer__btn-label')].map(e => e.textContent)
    expect(labels).toEqual(['map', 'bag', 'quests'])
    expect(screen.getByText('bag').parentElement.querySelector('i')?.className).toContain('fa-suitcase')
  })

  it('fires the handler of the clicked entry only', () => {
    const first = vi.fn()
    const second = vi.fn()
    render(
      <CardButtons name="Stats" onAction={vi.fn()} actionLabel="map"
        actionsList={[
          { label: 'bag', icon: 'fa-suitcase', onAction: first },
          { label: 'quests', icon: 'fa-scroll', onAction: second },
        ]} />
    )
    fireEvent.click(screen.getByText('quests'))
    expect(second).toHaveBeenCalled()
    expect(first).not.toHaveBeenCalled()
  })

  it('shares the in-progress spinner: a running secondary action hides every button', async () => {
    let resolve
    render(
      <CardButtons name="Stats" onAction={vi.fn()} actionLabel="map"
        actionsList={[{ label: 'bag', icon: 'fa-suitcase', onAction: () => new Promise(r => { resolve = r }) }]} />
    )
    fireEvent.click(screen.getByText('bag'))
    expect(screen.getByText('card.actionInProgress')).toBeInTheDocument()
    expect(screen.queryByText('bag')).not.toBeInTheDocument()

    resolve()
    await waitFor(() => expect(screen.getByText('bag')).toBeInTheDocument())
  })

  it('renders nothing extra for an empty list or for entries without a handler', () => {
    const { rerender } = render(<CardButtons name="Stats" onAction={vi.fn()} actionLabel="map" />)
    expect(document.querySelectorAll('.gc-footer__btn')).toHaveLength(1)

    rerender(
      <CardButtons name="Stats" onAction={vi.fn()} actionLabel="map"
        actionsList={[{ label: 'dead', icon: 'fa-ban' }]} />
    )
    expect(document.querySelectorAll('.gc-footer__btn')).toHaveLength(1)
    expect(screen.queryByText('dead')).not.toBeInTheDocument()
  })
})

describe('CardButtons preview (i) button overrides', () => {
  it('defaults to the fa-info icon and card.info label', () => {
    render(<CardButtons name="Stats" flagInformationCard onPreview={vi.fn()} onPreviewClick={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'card.info' })
    expect(btn.textContent).toContain('card.info')
    expect(btn.querySelector('i')?.className).toContain('fas fa-info')
  })

  it('uses infoLabel, infoIconClassName and infoLabelClassName overrides in the preview button', () => {
    render(
      <CardButtons name="Stats" flagInformationCard onPreview={vi.fn()} onPreviewClick={vi.fn()}
        infoLabel="Status" infoIconClassName="fas fa-info-circle font-size-medium"
        infoLabelClassName="font-size-medium" />
    )
    const btn = screen.getByRole('button', { name: 'Status' })
    expect(btn.textContent).toContain('Status')
    expect(btn.textContent).not.toContain('card.info')
    const iconClass = btn.querySelector('i')?.className
    expect(iconClass).toContain('fas fa-info-circle')
    expect(iconClass).toContain('font-size-medium')
    expect(iconClass).not.toMatch(/fas fa-info(?!-)/)
    const label = btn.querySelector('.gc-footer__btn-label')
    expect(label?.className).toContain('font-size-medium')
  })

  it('fires onPreviewClick when the overridden preview button is clicked', () => {
    const onPreviewClick = vi.fn()
    render(
      <CardButtons name="Stats" flagInformationCard onPreview={vi.fn()} onPreviewClick={onPreviewClick}
        infoLabel="Game Status" infoIconClassName="fas fa-info-circle" />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Game Status' }))
    expect(onPreviewClick).toHaveBeenCalled()
  })
})

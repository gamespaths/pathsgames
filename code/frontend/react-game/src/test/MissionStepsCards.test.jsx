import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))

const captured = []
vi.mock('@/components/layout/Card', () => ({
  default: (props) => { captured.push(props); return <div data-testid="step">{props.card.title}</div> },
}))

import MissionStepsCards, { visibleSteps }
  from '../features/gameplay/cards/MissionStepsCards'

const mission = (steps) => ({ uuid: 'm-1', name: 'The Journey', steps })

describe('MissionStepsCards (v0.37.1)', () => {
  it('renders what is closed plus the first step still open, and nothing behind it', () => {
    captured.length = 0
    render(<MissionStepsCards mission={mission([
      { uuid: 's-1', step: 1, name: 'Reach the hills', done: true },
      { uuid: 's-2', step: 2, name: 'Climb the peak', done: false },
      { uuid: 's-3', step: 3, name: 'Cross the pass', done: false },
    ])} />)

    // The third is not listed: the story has not asked for it yet.
    expect(screen.getAllByTestId('step').map(n => n.textContent))
      .toEqual(['Reach the hills', 'Climb the peak'])
    // No step NUMBER any more — a closed step says Completed, an open one says nothing.
    // The very badge a closed MISSION wears — same key, same label, same glyph.
    expect(captured[0].statistics).toEqual([{ key: 'missionStatus',
      value: 'game.missions.status.COMPLETED', label: 'game.missions.statusLabel',
      icon: 'fas fa-check-circle', color: null }])
    expect(captured[1].statistics).toEqual([])
  })

  it('lists every step once the mission has closed them all', () => {
    const steps = [{ uuid: 's-1', done: true, name: 'a' }, { uuid: 's-2', done: true, name: 'b' }]
    expect(visibleSteps(mission(steps))).toHaveLength(2)
    expect(visibleSteps(mission([]))).toEqual([])
    expect(visibleSteps(undefined)).toEqual([])
  })

  it('opens the step card as a page through the (i), on the side it was given', () => {
    captured.length = 0
    const onPreview = vi.fn()
    render(<MissionStepsCards mission={mission([{ uuid: 's-1', name: 'Reach the hills' }])}
      onPreview={onPreview} />)

    captured[0].onPreview()

    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({
      type: 'missions', side: 'right',
    }))
    expect(onPreview.mock.calls[0][0].card.title).toBe('Reach the hills')
    expect(captured[0].hidePreview).toBeUndefined()
  })

  it('locks a step this match has closed, and only that one', () => {
    captured.length = 0
    render(<MissionStepsCards mission={mission([
      { uuid: 's-1', step: 1, name: 'Done', done: true },
      { uuid: 's-2', step: 2, name: 'Open', done: false },
    ])} />)

    expect(captured[0].locked).toBe(true)
    expect(captured[0].lockInfo).toBe('game.missions.status.COMPLETED')
    expect(captured[1].locked).toBe(false)
    expect(captured[1].lockInfo).toBeUndefined()
  })

  it('falls back to the step name when the author wrote no card for it', () => {
    captured.length = 0
    render(<MissionStepsCards mission={mission([{ name: 'Nameless card' }])} />)

    expect(captured[0].card.title).toBe('Nameless card')
  })

  it('prefers the card the author wrote for the step', () => {
    captured.length = 0
    render(<MissionStepsCards mission={mission([
      { uuid: 's-1', name: 'raw', card: { title: 'Written', urlImage: 'u' }, description: 'd' },
    ])} />)

    expect(captured[0].card.title).toBe('Written')
    expect(captured[0].card.description).toBe('d')
  })

  it('says so when the mission lists no step, and when there is no mission at all', () => {
    render(<MissionStepsCards mission={mission([])} />)
    expect(screen.getAllByText('game.missions.stepsEmpty')).toHaveLength(1)

    render(<MissionStepsCards />)
    expect(screen.getAllByText('game.missions.stepsEmpty')).toHaveLength(2)
  })
})

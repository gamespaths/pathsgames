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

    // The third is not listed: the story has not asked for it yet. The open one reads FIRST.
    expect(screen.getAllByTestId('step').map(n => n.textContent))
      .toEqual(['Climb the peak', 'Reach the hills'])
    // No step NUMBER any more — a closed step says Completed, an open one says nothing.
    // The very badge a closed MISSION wears — same key, same glyph, and v0.37.3 no label:
    // the word next to the check is the whole message.
    expect(captured[0].statistics).toEqual([])
    expect(captured[1].statistics).toEqual([{ key: 'missionStatus',
      value: 'game.missions.status.COMPLETED',
      icon: 'fas fa-check-circle', color: null }])
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

    // The open step reads first: what is closed is ALWAYS last.
    expect(captured[0].card.title).toBe('Open')
    expect(captured[0].locked).toBe(false)
    expect(captured[0].lockInfo).toBeUndefined()
    expect(captured[1].card.title).toBe('Done')
    expect(captured[1].locked).toBe(true)
    expect(captured[1].lockInfo).toBe('game.missions.status.COMPLETED')
  })

  it('keeps the closed steps in the story order among themselves, after the open one', () => {
    expect(visibleSteps(mission([
      { uuid: 's-1', name: 'a', done: true }, { uuid: 's-2', name: 'b', done: true },
      { uuid: 's-3', name: 'c', done: false }, { uuid: 's-4', name: 'd', done: false },
    ])).map(s => s.name)).toEqual(['c', 'a', 'b'])
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

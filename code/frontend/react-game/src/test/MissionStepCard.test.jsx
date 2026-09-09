import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))

let captured = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => { captured = props; return <div data-testid="mission" /> },
}))

import MissionStepCard from '../features/gameplay/cards/MissionStepCard'

const mission = (over = {}) => ({
  uuid: 'm-1', name: 'Complete the Tutorial', status: 'ACTIVE',
  steps: [{ done: true }, { done: false }], ...over,
})

describe('MissionStepCard (Step 37)', () => {
  it('badges the step progress over the image, and not the status of an open mission', () => {
    render(<MissionStepCard mission={mission()} />)

    expect(captured.statistics.map(s => s.value)).toEqual(['1/2'])
    expect(captured.flagShowFullStatistics).toBe(true)
    // v0.37.1 — full-size badges: the little version renders no label, only a tooltip.
    expect(captured.statistics[0].label).toBe('game.missions.progress')
    expect(captured.bonusBadgeListLittleIntoImage).toBeUndefined()
  })

  it('badges the status only once the mission is closed', () => {
    render(<MissionStepCard mission={mission({ status: 'FAILED' })} />)
    expect(captured.statistics.map(s => s.key)).toEqual(['missionStatus', 'missionSteps'])

    render(<MissionStepCard mission={mission({ status: 'FAILED', steps: [] })} />)
    expect(captured.statistics.map(s => s.value)).toEqual(['game.missions.status.FAILED'])
    expect(captured.statistics[0].icon).toBe('fas fa-times-circle')

    render(<MissionStepCard mission={mission({ status: 'AVAILABLE' })} />)
    expect(captured.statistics.map(s => s.key)).not.toContain('missionStatus')
  })

  it('shows no badge at all for an open mission with no steps', () => {
    render(<MissionStepCard mission={mission({ steps: [] })} />)

    expect(captured.statistics).toEqual([])
  })

  it('counts no step on a mission that is DONE — Completed is the whole answer', () => {
    const onPreview = vi.fn()
    render(<MissionStepCard mission={mission({ status: 'COMPLETED' })} onPreview={onPreview} />)

    expect(captured.statistics.map(s => s.key)).toEqual(['missionStatus'])
    expect(captured.statistics[0].value).toBe('game.missions.status.COMPLETED')

    captured.onPreview()
    // The reading page still carries both: there the count is history, not a repetition.
    expect(onPreview.mock.calls[0][0].stats.map(s => s.key))
      .toEqual(['missionStatus', 'missionSteps'])
  })

  it('falls back to the mission name when the author wrote no card', () => {
    render(<MissionStepCard mission={mission()} />)

    expect(captured.card.title).toBe('Complete the Tutorial')
  })

  it('prefers the card the author did write', () => {
    render(<MissionStepCard mission={mission({ card: { title: 'Graduation', urlImage: 'u' } })} />)

    expect(captured.card.title).toBe('Graduation')
    expect(captured.hidePreview).toBe(false)
  })

  it('locks a closed mission and puts the hint in lockInfo, never in label', () => {
    render(<MissionStepCard mission={mission({ status: 'COMPLETED' })} />)

    expect(captured.locked).toBe(true)
    expect(captured.lockInfo).toBe('game.missions.status.COMPLETED')
    expect(captured.label).toBeUndefined()
  })

  it('locks a failed one the same way', () => {
    render(<MissionStepCard mission={mission({ status: 'FAILED' })} />)

    expect(captured.locked).toBe(true)
    expect(captured.lockedIcon).toBe('fas fa-times-circle')
  })

  it('leaves an open mission unlocked and unhinted', () => {
    render(<MissionStepCard mission={mission({ status: 'AVAILABLE' })} />)

    expect(captured.locked).toBe(false)
    expect(captured.lockInfo).toBeUndefined()
  })

  it('hides the lens only when there is no page and no step to turn to', () => {
    render(<MissionStepCard mission={mission()} />)
    // v0.37.1 — the steps are read on that page now, so a mission with steps keeps its lens.
    expect(captured.hidePreview).toBe(false)

    render(<MissionStepCard mission={mission({ steps: [] })} />)
    expect(captured.hidePreview).toBe(true)
  })

  it('opens the mission on the left page with its steps on the right', () => {
    const onOpenMission = vi.fn()
    const onPreview = vi.fn()
    render(<MissionStepCard mission={mission()} onOpenMission={onOpenMission}
      onPreview={onPreview} />)

    captured.onPreview()

    expect(onPreview).not.toHaveBeenCalled()
    const arg = onOpenMission.mock.calls[0][0]
    expect(arg.mission.uuid).toBe('m-1')
    expect(arg.card.title).toBe('Complete the Tutorial')
    expect(arg.stats.map(s => s.key)).toEqual(['missionStatus', 'missionSteps'])
  })

  it('hands the reading page the status, the progress and every step', () => {
    const onPreview = vi.fn()
    render(<MissionStepCard mission={mission({ card: { urlImage: 'u' } })}
      onPreview={onPreview} previewSide="left" />)

    captured.onPreview()

    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({
      type: 'missions', side: 'left',
      stats: [
        { key: 'missionStatus', value: 'game.missions.status.ACTIVE',
          label: 'game.missions.statusLabel' },
        { key: 'missionSteps', value: '1/2', label: 'game.missions.progress' },
      ],
    }))
    expect(onPreview.mock.calls[0][0].steps).toHaveLength(2)
  })
})

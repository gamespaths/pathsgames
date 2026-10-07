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

  it('badges the status of a closed mission over the image, beside the progress of a failed one', () => {
    render(<MissionStepCard mission={mission({ status: 'FAILED' })} />)
    // Step 40 — the status leaves the footer lock and rides as a badge, like the progress.
    expect(captured.statistics.map(s => s.key)).toEqual(['missionStatus', 'missionSteps'])
    expect(captured.statistics[0].value).toBe('game.missions.status.FAILED')
    expect(captured.statistics[0].icon).toBe('fas fa-times-circle')

    render(<MissionStepCard mission={mission({ status: 'FAILED', steps: [] })} />)
    expect(captured.statistics.map(s => s.key)).toEqual(['missionStatus'])

    render(<MissionStepCard mission={mission({ status: 'AVAILABLE' })} />)
    expect(captured.statistics.map(s => s.key)).not.toContain('missionStatus')
  })

  // v0.38.3 — a COMPLETED mission's card reads green (`pg-card--done`); nothing else does,
  // a failed or an open one included.
  it('paints only a completed mission green', () => {
    render(<MissionStepCard mission={mission({ status: 'COMPLETED' })} />)
    expect(captured.additionalCardClasses).toBe('pg-card--mission pg-card--done')
    render(<MissionStepCard mission={mission({ status: 'FAILED' })} />)
    expect(captured.additionalCardClasses).toBe('pg-card--mission')
    render(<MissionStepCard mission={mission()} />)
    expect(captured.additionalCardClasses).toBe('pg-card--mission')
  })

  it('shows no badge at all for an open mission with no steps', () => {
    render(<MissionStepCard mission={mission({ steps: [] })} />)

    expect(captured.statistics).toEqual([])
  })

  it('counts no step on a mission that is DONE — Completed is the whole answer', () => {
    const onPreview = vi.fn()
    render(<MissionStepCard mission={mission({ status: 'COMPLETED' })} onPreview={onPreview} />)

    // Step 40 — the grid card badges the status alone: Completed is the whole answer.
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

  it.each(['COMPLETED', 'FAILED', 'AVAILABLE'])('never locks a %s mission: the footer is the wide (i) alone', (status) => {
    render(<MissionStepCard mission={mission({ status })} />)

    expect(captured.locked).toBeUndefined()
    expect(captured.lockInfo).toBeUndefined()
    expect(captured.lockedIcon).toBeUndefined()
    expect(captured.label).toBeUndefined()
    expect(captured.flagInformationCard).toBe(true)
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
        { key: 'missionStatus', value: 'game.missions.status.ACTIVE', label: 'game.missions.statusLabel',
          icon: 'fas fa-hourglass-half', color: null, keepZero: true },
        { key: 'missionSteps', value: '1/2', label: 'game.missions.progress',
          icon: 'fas fa-list-ol', color: null },
      ],
    }))
    expect(onPreview.mock.calls[0][0].steps).toHaveLength(2)
  })
})

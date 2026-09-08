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
  it('badges the status and the step progress over the image', () => {
    render(<MissionStepCard mission={mission()} />)

    expect(captured.statistics.map(s => s.value))
      .toEqual(['game.missions.status.ACTIVE', '1/2'])
    expect(captured.flagShowFullStatistics).toBe(true)
    expect(captured.bonusBadgeListLittleIntoImage).toBe(true)
  })

  it('shows no progress badge for a mission with no steps at all', () => {
    render(<MissionStepCard mission={mission({ steps: [] })} />)

    expect(captured.statistics.map(s => s.key)).toEqual(['missionStatus'])
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
    expect(captured.lockedIcon).toBe('fas fa-circle-xmark')
  })

  it('leaves an open mission unlocked and unhinted', () => {
    render(<MissionStepCard mission={mission({ status: 'AVAILABLE' })} />)

    expect(captured.locked).toBe(false)
    expect(captured.lockInfo).toBeUndefined()
  })

  it('hides the lens when there is neither a picture nor a description to turn to', () => {
    render(<MissionStepCard mission={mission()} />)
    expect(captured.hidePreview).toBe(true)
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

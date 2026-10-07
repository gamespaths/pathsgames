import { describe, it, expect } from 'vitest'
import {
  MISSION_DONE_COLOR, missionCard, missionCompletedBadge, missionPageStats, missionProgress,
  missionProgressLabel, openMissions, orderedMissions,
} from '../utils/missions'

const mission = (name, status, steps = []) => ({ name, status, steps })

describe('missions utils (Step 37)', () => {
  it('puts what is still to do first, then names alphabetically', () => {
    const rows = [
      mission('Zeta', 'COMPLETED'), mission('Beta', 'AVAILABLE'),
      mission('Alpha', 'ACTIVE'), mission('Gamma', 'FAILED'),
    ]

    expect(orderedMissions(rows).map(m => m.name))
      .toEqual(['Alpha', 'Beta', 'Gamma', 'Zeta'])
  })

  it('reads an unknown status as late, but a completed mission is always the last', () => {
    const rows = [mission('Done', 'COMPLETED'), mission('Odd', 'WHAT'), mission('Open', 'ACTIVE')]
    expect(orderedMissions(rows).map(m => m.name)).toEqual(['Open', 'Odd', 'Done'])
  })

  it('treats anything that is not a list as no missions at all', () => {
    expect(orderedMissions(null)).toEqual([])
    expect(openMissions(undefined)).toEqual([])
  })

  it('counts only the missions still open: closed ones are not news', () => {
    const rows = [mission('a', 'ACTIVE'), mission('b', 'AVAILABLE'),
      mission('c', 'COMPLETED'), mission('d', 'FAILED')]

    expect(openMissions(rows).map(m => m.name)).toEqual(['a', 'b'])
  })

  it('reports how far down the steps a mission is', () => {
    const m = mission('m', 'ACTIVE', [{ done: true }, { done: true }, { done: false }])

    expect(missionProgress(m)).toEqual({ done: 2, total: 3 })
    expect(missionProgressLabel(m)).toBe('2/3')
  })

  it('has no progress to show for a mission with no steps at all', () => {
    expect(missionProgress(mission('m', 'AVAILABLE'))).toEqual({ done: 0, total: 0 })
    expect(missionProgressLabel(mission('m', 'AVAILABLE'))).toBeNull()
    expect(missionProgressLabel(null)).toBeNull()
  })
})

describe('mission reading page helpers (v0.38.2)', () => {
  const t = k => k

  it('reads as the authored card, falling back to the name and description', () => {
    expect(missionCard({ name: 'Quest', description: 'Go', card: { urlImage: 'i.png' } }))
      .toEqual({ urlImage: 'i.png', title: 'Quest', description: 'Go' })
    expect(missionCard({ name: 'Quest', card: { title: 'Authored', description: 'Written' } }))
      .toEqual({ title: 'Authored', description: 'Written' })
    expect(missionCard(null)).toEqual({ title: undefined, description: undefined })
  })

  it('badges the status and the progress with the little card glyphs, never the grey fallback', () => {
    const open = missionPageStats(t, mission('m', 'ACTIVE', [{ done: true }, { done: false }]))
    expect(open.map(s => s.key)).toEqual(['missionStatus', 'missionSteps'])
    expect(open[0].value).toBe('game.missions.status.ACTIVE')
    expect(open[0].label).toBe('game.missions.statusLabel')
    expect(open[0].icon).toBe('fas fa-hourglass-half')
    expect(open[0].keepZero).toBe(true)
    expect(open[1].value).toBe('1/2')
    expect(open[1].icon).toBe('fas fa-list-ol')

    const done = missionPageStats(t, mission('m', 'COMPLETED'))
    expect(done.map(s => s.key)).toEqual(['missionStatus'])
    expect(done[0].icon).toBe('fas fa-check-circle')
  })

  it('announces a completion as one green sentence, no label, glyph in the same green', () => {
    const badge = missionCompletedBadge(t)
    expect(badge.value).toBe('game.missions.completed')
    expect(badge.label).toBeNull()
    expect(badge.icon).toBe('fas fa-check-circle')
    expect(badge.color).toBe(MISSION_DONE_COLOR)
    expect(badge.className).toBe('bonus-badge--done')
  })

  it('shows the raw status when no translation exists', () => {
    expect(missionPageStats(() => '', mission('m', 'ODD'))[0].value).toBe('ODD')
  })
})

describe('Step 40 — the Completed check is green, as in the story list', () => {
  it('colours only the COMPLETED glyph, on the grid badge and on the reading page', async () => {
    const { missionStatusBadge, missionPageStats, MISSION_CHECK_COLOR } = await import('../utils/missions')
    const t = k => k
    expect(MISSION_CHECK_COLOR).toBe('#4ade80')
    expect(missionStatusBadge(t, 'COMPLETED').color).toBe(MISSION_CHECK_COLOR)
    expect(missionStatusBadge(t, 'FAILED').color).toBeNull()
    expect(missionPageStats(t, { status: 'COMPLETED' })[0].color).toBe(MISSION_CHECK_COLOR)
    expect(missionPageStats(t, { status: 'FAILED' })[0].color).toBeNull()
  })
})

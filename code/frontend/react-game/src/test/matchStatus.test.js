import { describe, it, expect } from 'vitest'
import { storyHasActiveMatch, storyHasBlockingMatch, storyMatchBadge } from '../utils/matchStatus'

const M = (storyUuid, status) => ({ uuid: `${storyUuid}-${status}`, storyUuid, status })

describe('matchStatus', () => {
  it('storyHasActiveMatch: true only for CREATED/RUNNING of that story', () => {
    const matches = [M('s1', 'RUNNING'), M('s2', 'ENDED')]
    expect(storyHasActiveMatch(matches, 's1')).toBe(true)
    expect(storyHasActiveMatch(matches, 's2')).toBe(false)
    expect(storyHasActiveMatch(matches, 's3')).toBe(false)
    expect(storyHasActiveMatch(null, 's1')).toBe(false)
  })

  it('storyHasBlockingMatch: PAUSED blocks too, terminal statuses do not', () => {
    expect(storyHasBlockingMatch([M('s1', 'PAUSED')], 's1')).toBe(true)
    expect(storyHasBlockingMatch([M('s1', 'CREATED')], 's1')).toBe(true)
    expect(storyHasBlockingMatch([M('s1', 'RUNNING')], 's1')).toBe(true)
    expect(storyHasBlockingMatch([M('s1', 'ENDED')], 's1')).toBe(false)
    expect(storyHasBlockingMatch([M('s1', 'GAMEOVER')], 's1')).toBe(false)
    expect(storyHasBlockingMatch([M('s2', 'PAUSED')], 's1')).toBe(false)
    expect(storyHasBlockingMatch(null, 's1')).toBe(false)
    // a paused match blocks a new run without being resumable
    expect(storyHasActiveMatch([M('s1', 'PAUSED')], 's1')).toBe(false)
  })

  it('storyMatchBadge: active wins, then paused, then completed, else null', () => {
    expect(storyMatchBadge([M('s1', 'CREATED')], 's1')).toBe('active')
    expect(storyMatchBadge([M('s1', 'RUNNING'), M('s1', 'ENDED')], 's1')).toBe('active')
    expect(storyMatchBadge([M('s1', 'PAUSED')], 's1')).toBe('paused')
    expect(storyMatchBadge([M('s1', 'RUNNING'), M('s1', 'PAUSED')], 's1')).toBe('active')
    expect(storyMatchBadge([M('s1', 'PAUSED'), M('s1', 'ENDED')], 's1')).toBe('paused')
    expect(storyMatchBadge([M('s1', 'ENDED')], 's1')).toBe('completed')
    expect(storyMatchBadge([M('s1', 'GAMEOVER')], 's1')).toBe(null)
    expect(storyMatchBadge([M('s2', 'RUNNING')], 's1')).toBe(null)
    expect(storyMatchBadge(null, 's1')).toBe(null)
  })
})

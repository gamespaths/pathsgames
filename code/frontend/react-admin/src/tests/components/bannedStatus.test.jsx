// v1.7.0 step 10 — BANNED is a terminal status, shown muted like CANCELLED.
import { describe, it, expect } from 'vitest'
import { STATUS_BADGE } from '../../components/match/MatchDetailModal'
import { TERMINAL, STATUS_COLOR } from '../../components/match/detail/matchDetailShared'

describe('BANNED match status', () => {
  it('is terminal and styled like CANCELLED', () => {
    expect(TERMINAL.has('BANNED')).toBe(true)
    expect(STATUS_BADGE.BANNED).toBe(STATUS_BADGE.CANCELLED)
    expect(STATUS_COLOR.BANNED).toEqual(STATUS_COLOR.CANCELLED)
  })
})

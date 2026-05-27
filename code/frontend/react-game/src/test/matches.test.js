import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../api/client'
import { createMatch, listMatches, getMatchInfo, endMatch } from '../api/matches'

vi.mock('../api/client', () => ({ apiClient: vi.fn() }))

describe('matches api', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('mock mode (no backend)', () => {
    beforeEach(() => apiClient.mockReturnValue(null))

    it('createMatch synthesizes a MatchSummary', async () => {
      const m = await createMatch({
        storyUuid: 's1', difficultyUuid: 'd1', singlePlayer: 1, traitUuids: ['t1'],
      })
      expect(m.uuid).toBeTruthy()
      expect(m.storyUuid).toBe('s1')
      expect(m.difficultyUuid).toBe('d1')
      expect(m.status).toBe('CREATED')
      expect(m.singlePlayer).toBe(1)
      expect(m.traitUuids).toEqual(['t1'])
    })

    it('createMatch tolerates a missing payload', async () => {
      const m = await createMatch()
      expect(m.status).toBe('CREATED')
      expect(m.traitUuids).toEqual([])
    })

    it('listMatches returns an empty array', async () => {
      expect(await listMatches()).toEqual([])
    })

    it('getMatchInfo returns null', async () => {
      expect(await getMatchInfo('m1')).toBeNull()
    })

    it('endMatch synthesizes an ENDED response carrying the match uuid', async () => {
      const res = await endMatch('m1', 'evt-end-1')
      expect(res.status).toBe('ENDED')
      expect(res.uuid).toBe('m1')
    })
  })

  describe('real server mode', () => {
    const post = vi.fn()
    const get = vi.fn()
    const patch = vi.fn()
    beforeEach(() => apiClient.mockReturnValue({ post, get, patch }))

    it('createMatch posts to /api/matches with the bearer token', async () => {
      post.mockResolvedValue({ data: { uuid: 'm1' } })
      const res = await createMatch({ storyUuid: 's1' }, 'tok-123')
      expect(post).toHaveBeenCalledWith(
        '/api/matches',
        { storyUuid: 's1' },
        expect.objectContaining({ headers: { Authorization: 'Bearer tok-123' } }),
      )
      expect(res).toEqual({ uuid: 'm1' })
    })

    it('createMatch posts without an Authorization header when no token', async () => {
      post.mockResolvedValue({ data: { uuid: 'm2' } })
      await createMatch({ storyUuid: 's1' })
      const cfg = post.mock.calls[0][2]
      expect(cfg.headers).toBeUndefined()
      expect(cfg.withCredentials).toBe(true)
    })

    it('createMatch propagates backend errors', async () => {
      post.mockRejectedValue(new Error('STORY_NOT_FOUND'))
      await expect(createMatch({ storyUuid: 'bad' }, 'tok')).rejects.toThrow('STORY_NOT_FOUND')
    })

    it('listMatches gets /api/matches', async () => {
      get.mockResolvedValue({ data: [{ uuid: 'm1' }] })
      expect(await listMatches('tok')).toEqual([{ uuid: 'm1' }])
      expect(get).toHaveBeenCalledWith('/api/matches', expect.any(Object))
    })

    it('getMatchInfo gets /api/match/{uuid}/info', async () => {
      get.mockResolvedValue({ data: { match: { uuid: 'm1' } } })
      await getMatchInfo('m1', 'tok')
      expect(get).toHaveBeenCalledWith('/api/match/m1/info', expect.any(Object))
    })

    it('endMatch PATCHes /api/match/{uuidMatch}/end/{uuidEvent} with the bearer token', async () => {
      patch.mockResolvedValue({ data: { status: 'ENDED', uuid: 'm1' } })
      const res = await endMatch('m1', 'evt-1', 'tok-xyz')

      expect(patch).toHaveBeenCalledWith(
        '/api/match/m1/end/evt-1',
        null,
        expect.objectContaining({ headers: { Authorization: 'Bearer tok-xyz' } }),
      )
      expect(res).toEqual({ status: 'ENDED', uuid: 'm1' })
    })

    it('endMatch propagates a 406 EVENT_NOT_END_GAME error', async () => {
      patch.mockRejectedValue(new Error('EVENT_NOT_END_GAME'))
      await expect(endMatch('m1', 'evt-wrong', 'tok')).rejects.toThrow('EVENT_NOT_END_GAME')
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../api/client'
import {
  createMatch, listMatches, getMatchInfo, endMatch,
  joinMatch, getMatchPlayers, getCharacter,
  startMatch, passTurn, getTurnSequence,
  getMatchClock, sleepCharacter,
} from '../api/matches'

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

    it('joinMatch synthesizes a character carrying the match uuid and loadout', async () => {
      const c = await joinMatch('m1', { characterTemplateUuid: 'ct1', traitUuids: ['t1'] })
      expect(c.uuid).toBeTruthy()
      expect(c.matchUuid).toBe('m1')
      expect(c.characterTemplateUuid).toBe('ct1')
      expect(c.traitUuids).toEqual(['t1'])
    })

    it('getMatchPlayers returns an empty array', async () => {
      expect(await getMatchPlayers('m1')).toEqual([])
    })

    it('getCharacter returns null', async () => {
      expect(await getCharacter('m1', 'c1')).toBeNull()
    })

    it('startMatch synthesizes a RUNNING turn sequence carrying the match uuid', async () => {
      const seq = await startMatch('m1')
      expect(seq.matchUuid).toBe('m1')
      expect(seq.status).toBe('RUNNING')
      expect(seq.queue).toEqual([])
    })

    it('passTurn synthesizes a RUNNING pass result carrying the match uuid', async () => {
      const res = await passTurn('m1')
      expect(res.matchUuid).toBe('m1')
      expect(res.status).toBe('RUNNING')
    })

    it('getTurnSequence synthesizes a sequence carrying the match uuid', async () => {
      const seq = await getTurnSequence('m1')
      expect(seq.matchUuid).toBe('m1')
      expect(seq.queue).toEqual([])
    })

    it('getMatchClock synthesizes an empty clock at 0 carrying the match uuid', async () => {
      const clock = await getMatchClock('m1')
      expect(clock.matchUuid).toBe('m1')
      expect(clock.currentClock).toBe(0)
      expect(clock.anyCharacterSleeping).toBe(false)
      expect(clock.characters).toEqual([])
    })

    it('sleepCharacter synthesizes a sleeping success without ending time', async () => {
      const res = await sleepCharacter('m1')
      expect(res.matchUuid).toBe('m1')
      expect(res.isSleeping).toBe(true)
      expect(res.timeEndTriggered).toBe(false)
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

    it('joinMatch posts to /api/matches/{uuid}/join with the loadout and bearer token', async () => {
      post.mockResolvedValue({ data: { uuid: 'c1', life: 137 } })
      const res = await joinMatch('m1', { characterTemplateUuid: 'ct1' }, 'tok-abc')
      expect(post).toHaveBeenCalledWith(
        '/api/matches/m1/join',
        { characterTemplateUuid: 'ct1' },
        expect.objectContaining({ headers: { Authorization: 'Bearer tok-abc' } }),
      )
      expect(res).toEqual({ uuid: 'c1', life: 137 })
    })

    it('joinMatch sends an empty body when no loadout is given', async () => {
      post.mockResolvedValue({ data: { uuid: 'c1' } })
      await joinMatch('m1', null, 'tok')
      expect(post).toHaveBeenCalledWith('/api/matches/m1/join', {}, expect.any(Object))
    })

    it('getMatchPlayers gets /api/match/{uuid}/players', async () => {
      get.mockResolvedValue({ data: [{ uuid: 'c1' }] })
      const res = await getMatchPlayers('m1', 'tok')
      expect(get).toHaveBeenCalledWith('/api/match/m1/players', expect.any(Object))
      expect(res).toEqual([{ uuid: 'c1' }])
    })

    it('getCharacter gets /api/match/{uuid}/characters/{uuidChar}', async () => {
      get.mockResolvedValue({ data: { uuid: 'c1', life: 137 } })
      await getCharacter('m1', 'c1', 'tok')
      expect(get).toHaveBeenCalledWith('/api/match/m1/characters/c1', expect.any(Object))
    })

    it('startMatch posts to /api/matches/{uuid}/start with the bearer token', async () => {
      post.mockResolvedValue({ data: { status: 'RUNNING', queue: [] } })
      const res = await startMatch('m1', 'tok-1')
      expect(post).toHaveBeenCalledWith(
        '/api/matches/m1/start',
        null,
        expect.objectContaining({ headers: { Authorization: 'Bearer tok-1' } }),
      )
      expect(res).toEqual({ status: 'RUNNING', queue: [] })
    })

    it('startMatch propagates a 409 NO_CHARACTERS_JOINED error', async () => {
      post.mockRejectedValue(new Error('NO_CHARACTERS_JOINED'))
      await expect(startMatch('m1', 'tok')).rejects.toThrow('NO_CHARACTERS_JOINED')
    })

    it('passTurn posts to /api/gameplay/{uuid}/action/pass with the bearer token', async () => {
      post.mockResolvedValue({ data: { status: 'RUNNING', passedCharacterUuid: 'c1' } })
      const res = await passTurn('m1', 'tok-2')
      expect(post).toHaveBeenCalledWith(
        '/api/gameplay/m1/action/pass',
        null,
        expect.objectContaining({ headers: { Authorization: 'Bearer tok-2' } }),
      )
      expect(res.passedCharacterUuid).toBe('c1')
    })

    it('passTurn propagates a 409 MATCH_NOT_RUNNING error', async () => {
      post.mockRejectedValue(new Error('MATCH_NOT_RUNNING'))
      await expect(passTurn('m1', 'tok')).rejects.toThrow('MATCH_NOT_RUNNING')
    })

    it('getTurnSequence gets /api/match/{uuid}/turn-sequence', async () => {
      get.mockResolvedValue({ data: { status: 'RUNNING', queue: [{ characterUuid: 'c1' }] } })
      const res = await getTurnSequence('m1', 'tok')
      expect(get).toHaveBeenCalledWith('/api/match/m1/turn-sequence', expect.any(Object))
      expect(res.queue).toEqual([{ characterUuid: 'c1' }])
    })

    it('getMatchClock gets /api/match/{uuid}/clock with the auth header', async () => {
      get.mockResolvedValue({ data: { matchUuid: 'm1', currentClock: 3 } })
      const res = await getMatchClock('m1', 'tok')
      expect(get).toHaveBeenCalledWith('/api/match/m1/clock', expect.any(Object))
      expect(res.currentClock).toBe(3)
    })

    it('sleepCharacter posts to /api/gameplay/{uuid}/action/sleep', async () => {
      post.mockResolvedValue({ data: { isSleeping: true, timeEndTriggered: true } })
      const res = await sleepCharacter('m1', 'tok')
      expect(post).toHaveBeenCalledWith(
        '/api/gameplay/m1/action/sleep', null, expect.any(Object),
      )
      expect(res.timeEndTriggered).toBe(true)
    })

    it('sleepCharacter propagates a 409 ALREADY_SLEEPING error', async () => {
      post.mockRejectedValue(new Error('ALREADY_SLEEPING'))
      await expect(sleepCharacter('m1', 'tok')).rejects.toThrow('ALREADY_SLEEPING')
    })
  })
})

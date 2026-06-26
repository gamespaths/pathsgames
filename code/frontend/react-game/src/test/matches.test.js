import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../api/client'
import {
  createMatch, listMatches, getMatchInfo, endMatch,
  joinMatch, getMatchPlayers, getCharacter,
  startMatch, passTurn, getTurnSequence,
  getMatchClock, sleepCharacter,
  startMovement, getMatchLocations,
} from '../api/matches'

vi.mock('../api/client', () => ({ apiClient: vi.fn() }))

describe('matches api', () => {
  beforeEach(() => vi.clearAllMocks())

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

    it('getMatchInfo gets /api/match/{uuid}/info with default lang', async () => {
      get.mockResolvedValue({ data: { match: { uuid: 'm1' } } })
      await getMatchInfo('m1', 'tok')
      expect(get).toHaveBeenCalledWith('/api/match/m1/info?lang=en', expect.any(Object))
    })

    it('getMatchInfo forwards the requested lang', async () => {
      get.mockResolvedValue({ data: { match: { uuid: 'm1' } } })
      await getMatchInfo('m1', 'tok', 'it')
      expect(get).toHaveBeenCalledWith('/api/match/m1/info?lang=it', expect.any(Object))
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

    it('startMovement posts the target location to /api/gameplay/{uuid}/movements/start', async () => {
      post.mockResolvedValue({ data: { toLocationUuid: 'loc2', energySpent: 3 } })
      const res = await startMovement('m1', 'loc2', 'tok-mv')
      expect(post).toHaveBeenCalledWith(
        '/api/gameplay/m1/movements/start',
        { targetLocationUuid: 'loc2' },
        expect.objectContaining({ headers: { Authorization: 'Bearer tok-mv' } }),
      )
      expect(res.energySpent).toBe(3)
    })

    it('startMovement propagates a 409 NOT_A_NEIGHBOR error', async () => {
      post.mockRejectedValue(new Error('NOT_A_NEIGHBOR'))
      await expect(startMovement('m1', 'loc9', 'tok')).rejects.toThrow('NOT_A_NEIGHBOR')
    })

    it('getMatchLocations gets /api/match/{uuid}/locations', async () => {
      get.mockResolvedValue({ data: { matchUuid: 'm1', locations: [{ idLocation: 1 }] } })
      const res = await getMatchLocations('m1', 'tok')
      expect(get).toHaveBeenCalledWith('/api/match/m1/locations', expect.any(Object))
      expect(res.locations).toEqual([{ idLocation: 1 }])
    })
  })
})

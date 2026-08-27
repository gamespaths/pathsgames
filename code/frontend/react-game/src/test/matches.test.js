import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../api/client'
import {
  createMatch, listMatches, getMatchInfo, endMatch,
  joinMatch, getMatchPlayers, getCharacter,
  startMatch, passTurn, getTurnSequence,
  getMatchClock, sleepCharacter,
  startMovement, getMatchLocations, getMatchLogs,
  executeEvent, selectChoice,
  getInventory, useItem, dropItem, getResources,
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

    it('getMatchLogs asks for the newest entries first by default', async () => {
      get.mockResolvedValue({ data: { logs: [], nextCursor: null } })
      await getMatchLogs('m1', 'tok')
      expect(get).toHaveBeenCalledWith('/api/matches/m1/logs',
        expect.objectContaining({ params: { order: 'desc' } }))
    })

    it('getMatchLogs forwards limit, cursor and lang alongside the order', async () => {
      get.mockResolvedValue({ data: { logs: [], nextCursor: 'n1' } })
      const res = await getMatchLogs('m1', 'tok', { limit: 10, cursor: 'c9', lang: 'it' })
      expect(get).toHaveBeenCalledWith('/api/matches/m1/logs',
        expect.objectContaining({ params: { limit: 10, cursor: 'c9', lang: 'it', order: 'desc' } }))
      expect(res.nextCursor).toBe('n1')
    })

    it('getMatchLogs lets the caller ask for the oldest entries first', async () => {
      get.mockResolvedValue({ data: { logs: [] } })
      await getMatchLogs('m1', 'tok', { order: 'asc' })
      expect(get).toHaveBeenCalledWith('/api/matches/m1/logs',
        expect.objectContaining({ params: { order: 'asc' } }))
    })

    it('getMatchLogs sends no params at all when every option is left out', async () => {
      get.mockResolvedValue({ data: { logs: [] } })
      await getMatchLogs('m1', 'tok', { order: null })
      expect(get).toHaveBeenCalledWith('/api/matches/m1/logs',
        expect.not.objectContaining({ params: expect.anything() }))
    })

    it('getMatchLocations asks in the requested language, and without one by default', async () => {
      get.mockResolvedValue({ data: { locations: [] } })
      await getMatchLocations('m1', 'tok', 'it')
      expect(get).toHaveBeenCalledWith('/api/match/m1/locations',
        expect.objectContaining({ params: { lang: 'it' } }))

      get.mockClear()
      await getMatchLocations('m1', 'tok')
      expect(get).toHaveBeenCalledWith('/api/match/m1/locations',
        expect.not.objectContaining({ params: expect.anything() }))
    })

    it('executeEvent posts the event uuid, carrying the language when asked', async () => {
      post.mockResolvedValue({ data: { status: 'APPLIED' } })
      const res = await executeEvent('m1', 'ev-1', 'tok', 'it')

      expect(post).toHaveBeenCalledWith(
        '/api/gameplay/m1/action/execute-event',
        { eventUuid: 'ev-1' },
        expect.objectContaining({ params: { lang: 'it' } }),
      )
      expect(res).toEqual({ status: 'APPLIED' })
    })

    it('executeEvent omits the language parameter when none is given', async () => {
      post.mockResolvedValue({ data: {} })
      await executeEvent('m1', 'ev-1', 'tok')
      expect(post.mock.calls[0][2].params).toBeUndefined()
    })

    it('executeEvent propagates a 409 ONCE_ALREADY_CONSUMED error', async () => {
      post.mockRejectedValue({ response: { status: 409, data: { error: 'ONCE_ALREADY_CONSUMED' } } })
      await expect(executeEvent('m1', 'ev-1', 'tok')).rejects.toMatchObject({
        response: { status: 409 },
      })
    })

    it('selectChoice posts the choice uuid, carrying the language when asked', async () => {
      post.mockResolvedValue({ data: { status: 'APPLIED', narrative: 'You chose well' } })
      const res = await selectChoice('m1', 'ch-1', 'tok', 'en')

      expect(post).toHaveBeenCalledWith(
        '/api/gameplay/m1/action/select-choice',
        { choiceUuid: 'ch-1' },
        expect.objectContaining({ params: { lang: 'en' } }),
      )
      expect(res.narrative).toBe('You chose well')
    })

    it('selectChoice omits the language parameter when none is given', async () => {
      post.mockResolvedValue({ data: {} })
      await selectChoice('m1', 'ch-1', 'tok')
      expect(post.mock.calls[0][2].params).toBeUndefined()
    })

    /* ── Steps 34 & 35 — inventory and resources ────────────────────────── */

    it('getInventory reads the caller inventory, carrying the language when asked', async () => {
      get.mockResolvedValue({ data: { items: [{ uuid: 'row-1' }], weight: 6, weightMax: 30 } })
      const res = await getInventory('m1', 'tok', 'it')

      expect(get).toHaveBeenCalledWith(
        '/api/gameplay/m1/inventory',
        expect.objectContaining({
          headers: { Authorization: 'Bearer tok' },
          params: { lang: 'it' },
        }),
      )
      expect(res.items[0].uuid).toBe('row-1')
    })

    it('getInventory omits the language parameter when none is given', async () => {
      get.mockResolvedValue({ data: {} })
      await getInventory('m1', 'tok')
      expect(get.mock.calls[0][1].params).toBeUndefined()
    })

    it('useItem posts the INVENTORY ROW uuid, not the story item uuid', async () => {
      post.mockResolvedValue({ data: { status: 'APPLIED', eventUuid: null } })
      const res = await useItem('m1', 'row-1', 'tok', 'en')

      expect(post).toHaveBeenCalledWith(
        '/api/gameplay/m1/inventory/use-item',
        { itemInstanceUuid: 'row-1' },
        expect.objectContaining({ params: { lang: 'en' } }),
      )
      // An item usage owns no event: the payload is execute-event's with a null eventUuid.
      expect(res.eventUuid).toBeNull()
    })

    it('useItem omits the language parameter when none is given', async () => {
      post.mockResolvedValue({ data: {} })
      await useItem('m1', 'row-1', 'tok')
      expect(post.mock.calls[0][2].params).toBeUndefined()
    })

    it('useItem propagates a refusal from the backend', async () => {
      post.mockRejectedValue({ response: { status: 409, data: { error: 'ITEM_NOT_CONSUMABLE' } } })
      await expect(useItem('m1', 'row-1', 'tok')).rejects.toMatchObject({
        response: { status: 409 },
      })
    })

    it('dropItem posts the row uuid and takes no language', async () => {
      post.mockResolvedValue({ data: { amountDropped: 3 } })
      const res = await dropItem('m1', 'row-2', 'tok')

      expect(post).toHaveBeenCalledWith(
        '/api/gameplay/m1/inventory/drop-item',
        { itemInstanceUuid: 'row-2' },
        expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
      )
      expect(post.mock.calls[0][2].params).toBeUndefined()
      expect(res.amountDropped).toBe(3)
    })

    it('getResources reads the plain numbers and takes no language', async () => {
      get.mockResolvedValue({ data: { food: 4, magic: 2, coin: 9, weight: 6, weightMax: 30 } })
      const res = await getResources('m1', 'tok')

      expect(get).toHaveBeenCalledWith(
        '/api/gameplay/m1/resources',
        expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
      )
      expect(get.mock.calls[0][1].params).toBeUndefined()
      // The backend field is `coin` (singular); the adapter is what renames it to `coins`.
      expect(res.coin).toBe(9)
    })
  })
})

// v1.7.0 V1 step 8 — If-Match from the stored matchVersion, replaced by every answer; STALE_MATCH never re-sent.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../api/client'
import {
  createMatch, getMatchInfo, endMatch, joinMatch, startMatch, passTurn, sleepCharacter,
  startMovement, executeEvent, selectChoice, useItem, useExp, dropItem,
} from '../api/matches'
import {
  STALE_EVENT, STALE_MATCH, clearMatchVersions, getMatchVersion, ifMatchHeaders, isStaleMatch,
  rememberMatchVersion, versionedWrite,
} from '../api/matchVersion'
import { DEFAULT_MATCH_REFETCH, readMatchRefetch } from '../context/ServerContext'

vi.mock('../api/client', () => ({ apiClient: vi.fn() }))

const stale = (version = 'v9') => Object.assign(new Error('409'), {
  response: { status: 409, data: { error: STALE_MATCH, matchVersion: version } },
})

describe('matchVersion store', () => {
  beforeEach(() => clearMatchVersions())

  it('remembers only real versions, per match', () => {
    rememberMatchVersion('m1', { matchVersion: 'v1' })
    rememberMatchVersion('m1', { matchVersion: null })
    rememberMatchVersion('m1', { matchVersion: '' })
    rememberMatchVersion('m1', {})
    rememberMatchVersion(null, { matchVersion: 'x' })
    rememberMatchVersion('m2', { matchVersion: 42 })
    expect(getMatchVersion('m1')).toBe('v1')
    expect(getMatchVersion('m2')).toBe('42')
    expect(getMatchVersion(null)).toBeNull()
    expect(getMatchVersion('none')).toBeNull()
    expect(ifMatchHeaders('m1')).toEqual({ 'If-Match': 'v1' })
    expect(ifMatchHeaders('none')).toEqual({})
  })

  it('tells a stale answer apart', () => {
    expect(isStaleMatch(stale())).toBe(true)
    expect(isStaleMatch({ staleMatch: true })).toBe(true)
    expect(isStaleMatch(STALE_MATCH)).toBe(true)
    expect(isStaleMatch({ response: { status: 409, data: { error: 'NOT_YOUR_TURN' } } })).toBe(false)
    expect(isStaleMatch(null)).toBe(false)
  })

  it('a refusal after the claim still moves the stored version', async () => {
    rememberMatchVersion('m1', { matchVersion: 'v1' })
    const refused = { response: { status: 409, data: { error: 'NOT_YOUR_TURN', matchVersion: 'v2' } } }
    await expect(versionedWrite('m1', () => Promise.reject(refused))).rejects.toBe(refused)
    expect(getMatchVersion('m1')).toBe('v2')
    await expect(versionedWrite('m1', () => Promise.reject(new Error('net')))).rejects.toThrow('net')
    expect(getMatchVersion('m1')).toBe('v2')
  })

  it('a stale answer is announced, marked and not remembered', async () => {
    rememberMatchVersion('m1', { matchVersion: 'v1' })
    const seen = vi.fn()
    window.addEventListener(STALE_EVENT, seen)
    const error = stale('v7')
    await expect(versionedWrite('m1', () => Promise.reject(error))).rejects.toBe(error)
    window.removeEventListener(STALE_EVENT, seen)
    expect(error.staleMatch).toBe(true)
    expect(seen).toHaveBeenCalledTimes(1)
    expect(seen.mock.calls[0][0].detail).toEqual({ matchUuid: 'm1', matchVersion: 'v7' })
    expect(getMatchVersion('m1')).toBe('v1')
  })

  it('a stale answer without a body version still announces null', async () => {
    const seen = vi.fn()
    window.addEventListener(STALE_EVENT, seen)
    await expect(versionedWrite('m1', () => Promise.reject({ staleMatch: true }))).rejects.toBeTruthy()
    window.removeEventListener(STALE_EVENT, seen)
    expect(seen.mock.calls[0][0].detail.matchVersion).toBeNull()
  })
})

describe('matches api with If-Match', () => {
  const post = vi.fn()
  const get = vi.fn()
  const patch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    clearMatchVersions()
    apiClient.mockReturnValue({ post, get, patch })
  })

  it('the create answer and /info give the version', async () => {
    post.mockResolvedValue({ data: { uuid: 'm1', matchVersion: 'c1' } })
    await createMatch({ storyUuid: 's' }, 'tok')
    expect(getMatchVersion('m1')).toBe('c1')
    get.mockResolvedValue({ data: { matchVersion: 'i1', match: { uuid: 'm1' } } })
    await getMatchInfo('m1', 'tok', 'en')
    expect(getMatchVersion('m1')).toBe('i1')
  })

  it('no header before a version is known', async () => {
    post.mockResolvedValue({ data: {} })
    await passTurn('m1', 'tok')
    expect(post.mock.calls[0][2].headers).toEqual({ Authorization: 'Bearer tok' })
  })

  const writes = [
    ['startMatch', () => startMatch('m1', 'tok'), post],
    ['joinMatch', () => joinMatch('m1', {}, 'tok'), post],
    ['passTurn', () => passTurn('m1', 'tok'), post],
    ['sleepCharacter', () => sleepCharacter('m1', 'tok'), post],
    ['startMovement', () => startMovement('m1', 'l2', 'tok'), post],
    ['executeEvent', () => executeEvent('m1', 'e1', 'tok', 'it'), post],
    ['selectChoice', () => selectChoice('m1', 'c1', 'tok', 'it'), post],
    ['useItem', () => useItem('m1', 'i1', 'tok', 'it'), post],
    ['useExp', () => useExp('m1', 'dex', 'tok'), post],
    ['dropItem', () => dropItem('m1', 'i1', 'tok'), post],
    ['endMatch', () => endMatch('m1', 'ev', 'tok'), patch],
  ]

  it.each(writes)('%s sends If-Match and keeps the new version', async (_name, call, verb) => {
    rememberMatchVersion('m1', { matchVersion: 'v1' })
    verb.mockResolvedValue({ data: { matchVersion: 'v2' } })
    await call()
    const config = verb.mock.calls[0][2]
    expect(config.headers).toEqual({ Authorization: 'Bearer tok', 'If-Match': 'v1' })
    expect(getMatchVersion('m1')).toBe('v2')
  })

  it('a 409 STALE_MATCH is not re-sent', async () => {
    rememberMatchVersion('m1', { matchVersion: 'v1' })
    post.mockRejectedValue(stale())
    await expect(passTurn('m1', 'tok')).rejects.toMatchObject({ staleMatch: true })
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('keeps the language parameter next to the header', async () => {
    rememberMatchVersion('m1', { matchVersion: 'v1' })
    post.mockResolvedValue({ data: {} })
    await executeEvent('m1', 'e1', 'tok', 'it')
    expect(post.mock.calls[0][2]).toMatchObject({ params: { lang: 'it' }, headers: { 'If-Match': 'v1' } })
  })
})

describe('readMatchRefetch', () => {
  it('reads the echo parameters with code defaults', () => {
    expect(readMatchRefetch({ matchRefetchBrowsers: ['ALL'], matchRefetchMinHiddenSeconds: 45 }))
      .toEqual({ browsers: ['all'], minHiddenSeconds: 45 })
    expect(readMatchRefetch({})).toEqual(DEFAULT_MATCH_REFETCH)
    expect(readMatchRefetch({ matchRefetchBrowsers: [], matchRefetchMinHiddenSeconds: null })).toEqual(DEFAULT_MATCH_REFETCH)
    expect(readMatchRefetch({ matchRefetchMinHiddenSeconds: -1 }).minHiddenSeconds).toBe(30)
    expect(readMatchRefetch({ matchRefetchMinHiddenSeconds: 'x' }).minHiddenSeconds).toBe(30)
    expect(readMatchRefetch({ matchRefetchMinHiddenSeconds: 0 }).minHiddenSeconds).toBe(0)
    expect(readMatchRefetch(null)).toEqual(DEFAULT_MATCH_REFETCH)
  })
})

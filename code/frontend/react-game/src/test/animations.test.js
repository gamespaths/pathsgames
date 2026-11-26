import { describe, it, expect } from 'vitest'
import {
  readAnimationEnv, resolveAnimations, applyAnimationTimings, scaledTimings,
  parseSpeed, parseTurnMode, parseDeck, parseCoverMax, BASE_TIMINGS, DEAL_MAX_STAGGER, DEFAULT_SPEED, DEFAULT_COVER_MAX,
} from '../constants/animations'

// Step 14 — the animation settings: env parsing, overrides, reduced motion, timings on <html>.
describe('readAnimationEnv', () => {
  it('defaults every key when the env names none', () => {
    expect(readAnimationEnv({})).toEqual({
      deal: true, dealFaceDown: true, play: true, turn: true, cover: true, turnMode: 'full', speed: 0.25, deck: 'under',
      coverMax: 10,
    })
    expect(readAnimationEnv(null)).toEqual(readAnimationEnv({}))
  })

  it('reads the build env by default', () => {
    expect(Object.keys(readAnimationEnv()).sort()).toEqual(
      ['cover', 'coverMax', 'deal', 'dealFaceDown', 'deck', 'play', 'speed', 'turn', 'turnMode'])
  })

  it('parses the four flags with parseFlag: false / 0 / no / off turn them off, empty keeps the default', () => {
    const env = { VITE_ANIM_DEAL: 'false', VITE_ANIM_DEAL_FACEDOWN: '0', VITE_ANIM_PLAY: 'no', VITE_ANIM_TURN: 'OFF' }
    expect(readAnimationEnv(env)).toMatchObject({ deal: false, dealFaceDown: false, play: false, turn: false })
    expect(readAnimationEnv({ VITE_ANIM_DEAL: '', VITE_ANIM_PLAY: 'true', VITE_ANIM_TURN: 'yes' }))
      .toMatchObject({ deal: true, play: true, turn: true })
  })

  it('turn mode: simple, anything else full', () => {
    expect(readAnimationEnv({ VITE_ANIM_TURN_MODE: 'simple' }).turnMode).toBe('simple')
    expect(parseTurnMode(' SIMPLE ')).toBe('simple')
    expect(parseTurnMode('full')).toBe('full')
    expect(parseTurnMode('flip')).toBe('full')
    expect(parseTurnMode(undefined)).toBe('full')
  })

  it('speed: a finite number > 0 clamped to 0.1–4, anything else 0.25', () => {
    expect(readAnimationEnv({ VITE_ANIM_SPEED: '1' }).speed).toBe(1)
    expect(parseSpeed(' 0.5 ')).toBe(0.5)
    expect(parseSpeed(2)).toBe(2)
    expect(parseSpeed('abc')).toBe(DEFAULT_SPEED)
    expect(parseSpeed('')).toBe(DEFAULT_SPEED)
    expect(parseSpeed(undefined)).toBe(DEFAULT_SPEED)
    expect(parseSpeed(null)).toBe(DEFAULT_SPEED)
    expect(parseSpeed('0')).toBe(DEFAULT_SPEED)
    expect(parseSpeed('-2')).toBe(DEFAULT_SPEED)
    expect(parseSpeed('Infinity')).toBe(DEFAULT_SPEED)
    expect(parseSpeed('0.01')).toBe(0.1)
    expect(parseSpeed('10')).toBe(4)
  })

  it('deck: under or over, anything else under', () => {
    expect(readAnimationEnv({ VITE_ANIM_DECK: 'over' }).deck).toBe('over')
    expect(parseDeck('OVER')).toBe('over')
    expect(parseDeck('under')).toBe('under')
    expect(parseDeck('beside')).toBe('under')
    expect(parseDeck(null)).toBe('under')
  })
})

describe('readAnimationEnv — step 15 book change', () => {
  it('VITE_ANIM_COVER: on by default, off with false / 0 / no / off', () => {
    expect(readAnimationEnv({}).cover).toBe(true)
    expect(readAnimationEnv({ VITE_ANIM_COVER: '' }).cover).toBe(true)
    expect(readAnimationEnv({ VITE_ANIM_COVER: 'false' }).cover).toBe(false)
    expect(readAnimationEnv({ VITE_ANIM_COVER: 'off' }).cover).toBe(false)
  })

  it('VITE_ANIM_COVER_MAX_S: seconds >= 0 (0 = no limit kept), default 10; negative, text or empty is 10', () => {
    expect(DEFAULT_COVER_MAX).toBe(10)
    expect(readAnimationEnv({}).coverMax).toBe(10)
    expect(readAnimationEnv({ VITE_ANIM_COVER_MAX_S: '6' }).coverMax).toBe(6)
    expect(readAnimationEnv({ VITE_ANIM_COVER_MAX_S: ' 2.5 ' }).coverMax).toBe(2.5)
    expect(readAnimationEnv({ VITE_ANIM_COVER_MAX_S: '0' }).coverMax).toBe(0)
    expect(parseCoverMax(4)).toBe(4)
    for (const bad of ['-1', -3, 'ten', '', '  ', null, undefined, true, Infinity, NaN]) expect(parseCoverMax(bad)).toBe(10)
  })

  it('the new phases slide and close are scaled as the others (¼×: 2.4 s, 1.04 s)', () => {
    expect(BASE_TIMINGS).toMatchObject({ slide: 600, close: 260 })
    expect(scaledTimings(0.25)).toMatchObject({ slide: 2400, close: 1040 })
  })

  it('`cover` is a flag (overridable, off under reduced motion); `coverMax` is env only', () => {
    const env = { VITE_ANIM_COVER_MAX_S: '4' }
    expect(resolveAnimations({ env })).toMatchObject({ cover: true, coverMax: 4 })
    expect(resolveAnimations({ env, overrides: { cover: false, coverMax: 99 } })).toMatchObject({ cover: false, coverMax: 4 })
    expect(resolveAnimations({ env, reducedMotion: true })).toMatchObject({ cover: false, coverMax: 4 })
    expect(resolveAnimations({ defaults: { ...readAnimationEnv({}), coverMax: undefined } }).coverMax).toBe(10)
  })
})

describe('resolveAnimations', () => {
  it('without overrides: the env, not reduced, timings scaled by the speed', () => {
    const s = resolveAnimations({ env: {} })
    expect(s).toMatchObject({ deal: true, dealFaceDown: true, play: true, turn: true, turnMode: 'full',
      speed: 0.25, deck: 'under', reduced: false })
    // one card flies about 2.5 s, the eighth leaves 3.1 s after the first
    expect(s.timings.deal).toBe(2480)
    expect(s.timings.dealStep * (DEAL_MAX_STAGGER - 1)).toBe(3080)
    expect(resolveAnimations().timings).toEqual(scaledTimings(resolveAnimations().speed))
  })

  it('overrides win key by key over the env; null / undefined / empty keep the env', () => {
    const env = { VITE_ANIM_DEAL: 'false', VITE_ANIM_TURN_MODE: 'simple', VITE_ANIM_DECK: 'over', VITE_ANIM_SPEED: '0.5' }
    const s = resolveAnimations({ env, overrides: { deal: true, play: false, turnMode: 'full', speed: 1, deck: 'under' } })
    expect(s).toMatchObject({ deal: true, play: false, turn: true, turnMode: 'full', speed: 1, deck: 'under' })
    expect(s.timings).toEqual({ ...BASE_TIMINGS })
    const kept = resolveAnimations({ env, overrides: { deal: null, turnMode: undefined, speed: '', deck: null } })
    expect(kept).toMatchObject({ deal: false, turnMode: 'simple', speed: 0.5, deck: 'over' })
  })

  it('reduced motion wins over env and overrides; the deck placement stays', () => {
    const s = resolveAnimations({ env: { VITE_ANIM_DECK: 'over' }, overrides: { deal: true, turn: true }, reducedMotion: true })
    expect(s).toMatchObject({ deal: false, dealFaceDown: false, play: false, turn: false, deck: 'over', reduced: true })
  })
})

describe('scaledTimings', () => {
  it('divides every base value by the speed, rounded', () => {
    expect(scaledTimings(1)).toEqual({ ...BASE_TIMINGS })
    expect(scaledTimings(0.25)).toMatchObject({ open: 2600, deal: 2480, dealStep: 440, flip: 3600 })
    expect(scaledTimings(3).deal).toBe(207)
  })
})

describe('applyAnimationTimings', () => {
  it('writes every --t-* variable and data-pg-reduced while reduced, then removes it', () => {
    const root = document.createElement('div')
    applyAnimationTimings(resolveAnimations({ env: {}, reducedMotion: true }), root)
    expect(root.style.getPropertyValue('--t-deal')).toBe('2480ms')
    expect(root.style.getPropertyValue('--t-dealStep')).toBe('440ms')
    expect(root.style.getPropertyValue('--t-sheet')).toBe('2480ms')
    expect(root).toHaveAttribute('data-pg-reduced', 'true')
    applyAnimationTimings(resolveAnimations({ env: { VITE_ANIM_SPEED: '1' } }), root)
    expect(root.style.getPropertyValue('--t-deal')).toBe('620ms')
    expect(root).not.toHaveAttribute('data-pg-reduced')
  })

  it('defaults to <html> and ignores a missing root or settings', () => {
    applyAnimationTimings(resolveAnimations({ env: { VITE_ANIM_SPEED: '2' } }))
    expect(document.documentElement.style.getPropertyValue('--t-deal')).toBe('310ms')
    expect(() => applyAnimationTimings(resolveAnimations({ env: {} }), null)).not.toThrow()
    expect(() => applyAnimationTimings(null, document.createElement('div'))).not.toThrow()
  })
})

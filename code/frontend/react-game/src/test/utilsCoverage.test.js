import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildConfigStatistics,
  getOptionLockInfo,
  isClassAllowedByTemplate,
  buildClassesById,
} from '../utils/bonusStats'
import { buildCardSad, buildCardComa, buildEndGameCard } from '../utils/loadoutCards'

// Small direct-call suite for the pure helpers: the paths the component suites
// never reach (default translator, unknown option types, missing restrictions).

describe('utils/bonusStats — buildConfigStatistics', () => {
  // Called without a translator it falls back to echoing the i18n key, so the
  // badge still carries something readable.
  it('labels the totals with the raw i18n key when no translator is given', () => {
    const stats = buildConfigStatistics({
      character: { lifeMax: 10, dexterityStart: 2 },
      class: null,
      traits: null,          // not an array → treated as no traits
      difficulty: null,
    })
    expect(stats.length).toBeGreaterThan(0)
    expect(stats[0].label).toBe(`book.stats.totals.${stats[0].key}`)
  })

  it('sums the selected traits into the totals', () => {
    const withTrait = buildConfigStatistics({
      character: { lifeMax: 10 },
      traits: [{ life: 5 }],
    })
    const life = withTrait.find(s => s.key === 'life')
    expect(life.value).toBe(15)
  })
})

describe('utils/bonusStats — getOptionLockInfo', () => {
  const classesById = buildClassesById([{ id: 1, card: { title: 'Fighter' } }])

  // Only class / character / trait are lockable; anything else is never locked.
  it('never locks an option of an unknown type', () => {
    expect(getOptionLockInfo({ type: 'difficulty', option: { id: 9 }, config: {}, classesById })).toBeNull()
    expect(getOptionLockInfo({ type: 'character', option: null, config: {}, classesById })).toBeNull()
  })

  // A class option is always selectable in the class step.
  it('never locks a class option', () => {
    expect(getOptionLockInfo({ type: 'class', option: { id: 2 }, config: { character: { idClassPermitted: 1 } }, classesById })).toBeNull()
  })

  // Without a selected class there is nothing to compare a restriction against.
  it('leaves character and trait options open while no class is selected', () => {
    expect(getOptionLockInfo({ type: 'character', option: { idClassPermitted: 1 }, config: {}, classesById })).toBeNull()
    expect(getOptionLockInfo({ type: 'trait', option: { idClassPermitted: 1 }, config: {}, classesById })).toBeNull()
  })

  // A class carrying neither id nor uuid gives nothing to evaluate.
  it('leaves an option open when the selected class has no identifier', () => {
    expect(getOptionLockInfo({ type: 'character', option: { idClassPermitted: 1 }, config: { class: {} }, classesById })).toBeNull()
    expect(getOptionLockInfo({ type: 'trait', option: { idClassProhibited: 1 }, config: { class: {} }, classesById })).toBeNull()
  })

  // An empty restriction column is not a restriction.
  it('treats an empty restriction column as no restriction', () => {
    expect(getOptionLockInfo({ type: 'trait', option: { idClassPermitted: '', idClassProhibited: '' }, config: { class: { id: 1 } }, classesById })).toBeNull()
  })

  // A trait that demands another class reports the required class by name.
  it('locks a trait that requires a different class, naming it', () => {
    const lock = getOptionLockInfo({ type: 'trait', option: { idClassPermitted: 1 }, config: { class: { id: 2 } }, classesById })
    expect(lock).toMatchObject({ kind: 'requires', classId: 1, className: 'Fighter' })
  })

  // A trait forbidden to the selected class reports the prohibition.
  it('locks a trait prohibited to the selected class', () => {
    const lock = getOptionLockInfo({ type: 'trait', option: { idClassProhibited: 1 }, config: { class: { id: 1 } }, classesById })
    expect(lock).toMatchObject({ kind: 'prohibited', classId: 1 })
  })
})

describe('utils/bonusStats — isClassAllowedByTemplate', () => {
  it('allows everything when either side is missing', () => {
    expect(isClassAllowedByTemplate(null, { idClassPermitted: 1 })).toBe(true)
    expect(isClassAllowedByTemplate({ id: 1 }, null)).toBe(true)
  })

  it('honours the template permitted/prohibited columns', () => {
    expect(isClassAllowedByTemplate({ id: 1 }, { idClassPermitted: 1 })).toBe(true)
    expect(isClassAllowedByTemplate({ id: 2 }, { idClassPermitted: 1 })).toBe(false)
    expect(isClassAllowedByTemplate({ uuid: 'c3' }, { idClassProhibited: 'c3' })).toBe(false)
  })
})

// Step 30 — the edge-state meta cards.
describe('utils/loadoutCards — edge state cards', () => {
  const t = (k) => k

  it('builds the sadness, coma and end-game meta cards from the i18n keys', () => {
    expect(buildCardSad(t)).toMatchObject({ title: 'game.sad.title', description: 'game.sad.description' })
    expect(buildCardComa(t)).toMatchObject({ title: 'game.coma.title', description: 'game.coma.description' })
    expect(buildEndGameCard(t)).toMatchObject({ title: 'game.endGameCard.title' })
  })
})

// The widget appearance is read once per site key from the environment.
describe('utils/turnstile — appearance', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

  it('keeps "interaction-only" and falls back to "always" for anything else', async () => {
    vi.stubEnv('VITE_TURNSTILE_APPEARANCE_HOME', 'interaction-only')
    vi.stubEnv('VITE_TURNSTILE_APPEARANCE_START', 'invisible')   // unsupported → always
    vi.resetModules()
    const { TURNSTILE_APPEARANCE } = await import('../utils/turnstile')
    expect(TURNSTILE_APPEARANCE.home).toBe('interaction-only')
    expect(TURNSTILE_APPEARANCE.config).toBe('always')
    expect(TURNSTILE_APPEARANCE.guest).toBe('always')
  })

  // A configured TTL wins over the 3000-minute default; a bad one does not.
  it('reads the pass TTL from the environment, ignoring a non-positive value', async () => {
    vi.stubEnv('VITE_TURNSTILE_PASS_TTL_MINUTES', '15')
    vi.resetModules()
    const mod = await import('../utils/turnstile')
    expect(mod.TURNSTILE_PASS_TTL_MIN).toBe(15)

    vi.stubEnv('VITE_TURNSTILE_PASS_TTL_MINUTES', '-1')
    vi.resetModules()
    const fallback = await import('../utils/turnstile')
    expect(fallback.TURNSTILE_PASS_TTL_MIN).toBe(3000)
  })
})

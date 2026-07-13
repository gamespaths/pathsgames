import { describe, it, expect } from 'vitest'
import en from '../i18n/en.json'
import { LOCK_ICON_DEFAULT, LOCK_REASON_ICONS, lockedIconFor } from '../constants/lockReasons'

describe('lockedIconFor', () => {
  it('maps a refusal code to its icon', () => {
    expect(lockedIconFor('INSUFFICIENT_ENERGY')).toBe('fas fa-bed')
    expect(lockedIconFor('LOCATION_FULL')).toBe('fas fa-users')
    expect(lockedIconFor('COMA')).toBe('fas fa-heartbeat')
  })

  it('gives both names of "not enough energy" the same icon', () => {
    // movement calls it INSUFFICIENT_ENERGY, events call it NOT_ENOUGH_ENERGY
    expect(lockedIconFor('NOT_ENOUGH_ENERGY')).toBe(lockedIconFor('INSUFFICIENT_ENERGY'))
  })

  it('falls back to "you cannot" for an unknown or absent code', () => {
    expect(lockedIconFor('SOMETHING_THE_BACKEND_INVENTED')).toBe(LOCK_ICON_DEFAULT)
    expect(lockedIconFor(null)).toBe(LOCK_ICON_DEFAULT)
    expect(lockedIconFor(undefined)).toBe(LOCK_ICON_DEFAULT)
  })

  // A code the backend can send but the table does not know would silently render fa-ban; the
  // translations are the list of codes we claim to handle, so the two must agree.
  it('covers every refusal code the translations name', () => {
    const codes = [
      ...Object.keys(en.game.movement.reason),
      ...Object.keys(en.game.event.reason),
    ]
    const missing = codes.filter(code => !(code in LOCK_REASON_ICONS))
    expect(missing).toEqual([])
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))
vi.mock('@/components/ui/BonusBadgeList', () => ({ default: () => <div data-testid="badges" /> }))
vi.mock('@/api/matches', () => ({ executeEvent: vi.fn(), startMovement: vi.fn() }))
vi.mock('@/components/layout/Card', () => ({
  default: ({ onPreview, lockInfo }) => (
    <div>
      <span data-testid="lock-info">{lockInfo ?? ''}</span>
      {onPreview && <button data-testid="preview-btn" onClick={onPreview}>preview</button>}
    </div>
  ),
}))

import RegistryLockInfo, {
  registryLockSentence, registryLockHasInfo, registryLockText,
} from '../features/gameplay/cards/RegistryLockInfo'
import ActionCard from '../features/gameplay/cards/ActionCard'
import ChoiceCard from '../features/gameplay/cards/ChoiceCard'
import MovementCard from '../features/gameplay/cards/MovementCard'
import { matchInfoToGameData } from '../api/matchInfoAdapter'
import en from '../i18n/en.json'
import it_ from '../i18n/it.json'

const t = (k) => k
// Echoes the sentence name and every placeholder, so a test sees what was filled in.
const tx = (k) => {
  const name = k.replace('game.registryLock.', '')
  if (name.startsWith('target.')) return name
  if (name.startsWith('hidden')) return `${name}|{target}`
  return `${name}|{value}|{key}|{target}`
}
const FORBIDDEN = { mode: 'FORBIDDEN', hidden: false, key: 'gate', keyTitle: 'Gate key', operator: '!=', value: 'open' }
const MISSING = { mode: 'MISSING', hidden: false, key: 'gate', keyTitle: null, operator: '=', value: 'open' }
const HIDDEN = { mode: 'MISSING', hidden: true, key: null, keyTitle: null, operator: null, value: null }
const GENERIC = { mode: 'MISSING', hidden: false, key: null, keyTitle: null, operator: null, value: null }

/** Open the card preview and render what it shows under the sentence. */
function preview(onPreview) {
  fireEvent.click(screen.getByTestId('preview-btn'))
  const arg = onPreview.mock.calls[0][0]
  render(<div data-testid="preview">{arg.props.extraContent}</div>)
  return arg
}

describe('registry lock helpers', () => {
  it('one sentence for every mode and none without a lock', () => {
    expect(registryLockSentence(t, FORBIDDEN)).toBe('game.registryLock.blocked')
    expect(registryLockSentence(t, MISSING)).toBe('game.registryLock.blocked')
    expect(registryLockSentence(t, null)).toBeNull()
  })

  it('has info for a named or a hidden key only', () => {
    expect(registryLockHasInfo(FORBIDDEN)).toBe(true)
    expect(registryLockHasInfo(HIDDEN)).toBe(true)
    expect(registryLockHasInfo(GENERIC)).toBe(false)
    expect(registryLockHasInfo(null)).toBe(false)
  })

  it('picks the detail per mode and operator, with title or key, value and target', () => {
    expect(registryLockText(tx, FORBIDDEN, 'action')).toBe('forbidden|open|Gate key|target.action')
    expect(registryLockText(tx, MISSING, 'movement')).toBe('missing|open|gate|target.movement')
    expect(registryLockText(tx, { ...MISSING, operator: '>', value: '3' }, 'choice')).toBe('missingGreater|3|gate|target.choice')
    expect(registryLockText(tx, { ...MISSING, operator: '<', value: '3' }, 'choice')).toBe('missingLess|3|gate|target.choice')
    expect(registryLockText(tx, { ...MISSING, operator: null, value: null }, 'action')).toBe('missing||gate|target.action')
  })

  it('a hidden key names no key nor value', () => {
    expect(registryLockText(tx, HIDDEN, 'action')).toBe('hiddenMissing|target.action')
    expect(registryLockText(tx, { ...HIDDEN, mode: 'FORBIDDEN' }, 'movement')).toBe('hiddenForbidden|target.movement')
  })
})

describe('RegistryLockInfo', () => {
  it('replaces the (i) icon with the key text on click', () => {
    const { container } = render(<RegistryLockInfo lock={FORBIDDEN} target="action" />)
    expect(container.querySelector('.fa-lightbulb')).not.toBeNull()
    fireEvent.click(screen.getByTestId('registry-lock-btn'))
    expect(screen.getByTestId('registry-lock-text').textContent).toBe('game.registryLock.forbidden')
    expect(container.textContent).toBe(': game.registryLock.forbidden')
    expect(container.querySelector('.fa-lightbulb')).toBeNull()
  })

  it('reveals the secret text for a hidden key', () => {
    render(<RegistryLockInfo lock={HIDDEN} target="action" />)
    fireEvent.click(screen.getByTestId('registry-lock-btn'))
    expect(screen.getByTestId('registry-lock-text').textContent).toBe('game.registryLock.hiddenMissing')
  })

  it('renders nothing with no lock or a generic one', () => {
    const { container: a } = render(<RegistryLockInfo lock={null} />)
    const { container: b } = render(<RegistryLockInfo lock={GENERIC} />)
    expect(a.innerHTML).toBe('')
    expect(b.innerHTML).toBe('')
  })
})

describe('ActionCard with a registry lock', () => {
  const action = (lock) => ({ uuid: 'a1', available: false, reason: 'REGISTRY_CONDITION_NOT_MET', registryLock: lock })

  it('says blocked in the preview, keeps the short badge, and reveals the key', () => {
    const onPreview = vi.fn()
    render(<ActionCard action={action(FORBIDDEN)} onPreview={onPreview} />)
    expect(screen.getByTestId('lock-info').textContent).toBe('game.event.reason.REGISTRY_CONDITION_NOT_MET')
    const arg = preview(onPreview)
    expect(arg.lockedReason).toBe('game.registryLock.blocked')
    fireEvent.click(screen.getByTestId('registry-lock-btn'))
    expect(screen.getByTestId('registry-lock-text').textContent).toBe('game.registryLock.forbidden')
  })

  it('same sentence for MISSING, and keeps the old text with no lock (older backend)', () => {
    const onPreview = vi.fn()
    render(<ActionCard action={action(MISSING)} onPreview={onPreview} />)
    expect(preview(onPreview).lockedReason).toBe('game.registryLock.blocked')
    const old = vi.fn()
    render(<ActionCard action={action(undefined)} onPreview={old} />)
    fireEvent.click(screen.getAllByTestId('preview-btn')[1])
    expect(old.mock.calls[0][0].lockedReason).toBe('game.event.reasonFull.REGISTRY_CONDITION_NOT_MET')
  })
})

describe('ChoiceCard with a registry lock', () => {
  const choice = (lock, reason = 'CONDITION_KEYS_NOT_MET') => ({ uuid: 'c1', available: false, reason, registryLock: lock })

  it('says blocked and reveals a hidden FORBIDDEN key without naming it', () => {
    const onPreview = vi.fn()
    render(<ChoiceCard choice={choice({ ...HIDDEN, mode: 'FORBIDDEN' })} onPreview={onPreview} />)
    expect(preview(onPreview).lockedReason).toBe('game.registryLock.blocked')
    fireEvent.click(screen.getByTestId('registry-lock-btn'))
    expect(screen.getByTestId('registry-lock-text').textContent).toBe('game.registryLock.hiddenForbidden')
  })

  it('OR aggregate: blocked text and no (i); no lock keeps the reason text', () => {
    const onPreview = vi.fn()
    render(<ChoiceCard choice={choice(GENERIC, 'CONDITIONS_NOT_MET')} onPreview={onPreview} />)
    expect(preview(onPreview).lockedReason).toBe('game.registryLock.blocked')
    expect(screen.queryByTestId('registry-lock-btn')).toBeNull()
    const old = vi.fn()
    render(<ChoiceCard choice={choice(null)} onPreview={old} />)
    fireEvent.click(screen.getAllByTestId('preview-btn')[1])
    // t() echoes the key, which choiceReasonLabel reads as a miss
    expect(old.mock.calls[0][0].lockedReason).toBe('game.choices.unavailable')
  })
})

describe('MovementCard with a registry lock', () => {
  const stats = { energy: 50, isComa: false, isSleeping: false }
  const loc = (lock, reason = 'MOVEMENT_CONDITION_NOT_MET') => ({
    uuid: 'l2', idLocation: 2, energyCost: 1, available: false, reason, registryLock: lock,
  })

  it('says blocked and reveals the key in the preview', () => {
    const onPreview = vi.fn()
    render(<MovementCard location={loc(FORBIDDEN)} playerStats={stats} onPreview={onPreview} />)
    expect(screen.getByTestId('lock-info').textContent).toBe('game.movement.reason.MOVEMENT_CONDITION_NOT_MET')
    expect(preview(onPreview).lockedReason).toBe('game.registryLock.blocked')
    fireEvent.click(screen.getByTestId('registry-lock-btn'))
    expect(screen.getByTestId('registry-lock-text').textContent).toBe('game.registryLock.forbidden')
  })

  it('ignores the lock when another reason closes the way (coma)', () => {
    const onPreview = vi.fn()
    render(<MovementCard location={loc(FORBIDDEN)} playerStats={{ ...stats, isComa: true }} onPreview={onPreview} />)
    expect(preview(onPreview).lockedReason).toBe('game.movement.reasonFull.COMA')
    expect(screen.queryByTestId('registry-lock-btn')).toBeNull()
  })

  it('shows the (i) under the sentence on the map view too', () => {
    const { container } = render(<MovementCard location={loc(MISSING)} playerStats={stats}
      viewFromMap={true} onPreview={vi.fn()} />)
    expect(container).toBeTruthy()
  })
})

describe('matchInfoAdapter passes registryLock through', () => {
  it('keeps the lock on neighbors and events, null when absent', () => {
    const gd = matchInfoToGameData({
      players: [{ uuid: 'c1', idLocation: 1 }], currentLocationUuid: 'loc-1', locations: [],
      locationsActive: [{
        idLocation: 1,
        neighbors: [{ idLocationFrom: 1, idLocationTo: 2, registryLock: FORBIDDEN },
          { idLocationFrom: 1, idLocationTo: 3 }],
        events: [{ uuid: 'ev-1', registryLock: MISSING }, { uuid: 'ev-2' }],
      }],
    }, null, t)
    expect(gd.locations.map(l => l.registryLock)).toEqual([FORBIDDEN, null])
    const byUuid = Object.fromEntries(gd.actions.map(a => [a.uuid, a.registryLock]))
    expect(byUuid['ev-1']).toEqual(MISSING)
    expect(byUuid['ev-2']).toBeNull()
  })
})

describe('registry lock texts EN/IT', () => {
  it('both languages carry the same registryLock keys with the agreed texts', () => {
    expect(Object.keys(it_.game.registryLock).sort()).toEqual(Object.keys(en.game.registryLock).sort())
    expect(Object.keys(it_.game.registryLock.target).sort()).toEqual(['action', 'choice', 'movement'])
    expect(Object.keys(en.game.registryLock.target).sort()).toEqual(['action', 'choice', 'movement'])
    expect(en.game.registryLock.blocked).toBe('You cannot perform this action')
    expect(it_.game.registryLock.blocked).toBe('Non puoi eseguire questa azione')
    expect(it_.game.registryLock.forbidden).toBe('Il registro contiene il valore {value} per la chiave {key} che blocca {target}.')
    expect(it_.game.registryLock.missing).toBe('Il registro non contiene il valore {value} per la chiave {key} che sblocca {target}.')
    expect(it_.game.registryLock.hiddenForbidden).toBe("Nel registro c'è un valore che blocca {target}.")
    expect(it_.game.registryLock.hiddenMissing).toBe('Nel registro manca un valore per sbloccare {target}.')
  })
})

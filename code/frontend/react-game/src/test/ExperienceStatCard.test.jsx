import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

const useExp = vi.fn()
vi.mock('@/api/matches', () => ({
  useExp: (...args) => useExp(...args),
}))

let capturedProps = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    capturedProps = props
    const { card, onPreview, onAction, actionLabel, entityType, locked, lockInfo, childrenIntoImage } = props
    return (
      <div data-testid="exp-stat-card">
        <span data-testid="card-title">{card?.title}</span>
        <span data-testid="entity-type">{entityType}</span>
        <span data-testid="locked">{String(!!locked)}</span>
        <span data-testid="lock-info">{lockInfo ?? ''}</span>
        <div data-testid="face">{childrenIntoImage}</div>
        {onPreview && <button data-testid="preview-btn" onClick={onPreview}>preview</button>}
        {onAction && <button data-testid="action-btn" onClick={onAction}>{actionLabel}</button>}
      </div>
    )
  },
}))

import ExperienceStatCard from '../features/gameplay/cards/ExperienceStatCard'
import ExperienceCards from '../features/gameplay/cards/ExperienceCards'

const STORY = { uuid: 's1' }
const AFFORDABLE = { stat: 'dex', key: 'dexterity', value: 10, cost: 23, atCap: false, affordable: true }
const TOO_DEAR = { ...AFFORDABLE, affordable: false }
const CAPPED = { stat: 'int', key: 'intelligence', value: 12, cost: null, atCap: true, affordable: false }

const faceBadges = () => [...screen.getByTestId('face').querySelectorAll('.stat-badge')].map(b => b.textContent)

describe('ExperienceStatCard (Step 38)', () => {
  beforeEach(() => {
    capturedProps = null
    useExp.mockReset()
    useExp.mockResolvedValue({ stat: 'dex', statAfter: 11 })
  })

  it('renders the stat on its own picture, with Actual / Actual / Cost / After on the face and no (i)', () => {
    render(<ExperienceStatCard row={AFFORDABLE} experience={40} story={STORY} matchUuid="m1" />)
    expect(screen.getByTestId('card-title').textContent).toBe('game.stats.dexterity')
    expect(screen.getByTestId('entity-type').textContent).toBe('experience')
    expect(screen.getByTestId('locked').textContent).toBe('false')
    // the `experience-dex` entry of data/images.json: the stat's own glyph (its picture is
    // whatever the entry says — a blank one lets the glyph stand as the placeholder)
    expect(capturedProps.card).toHaveProperty('urlImage')
    expect(capturedProps.card.awesomeIcon).toBe('fas fa-running')
    expect(capturedProps.card.description).toBe('game.stats.descriptions.dexterity')
    // the face badges keep their words and their order
    expect(faceBadges()).toEqual([
      'game.exp.current:10', 'game.exp.held:40', 'game.exp.cost:23', 'game.exp.after:11',
    ])
    // no reading page, no (i): the button is the whole footer
    expect(capturedProps.onPreview).toBeUndefined()
    expect(capturedProps.hidePreview).toBe(true)
    expect(screen.queryByTestId('preview-btn')).toBeNull()
    expect(capturedProps.actionLabel).toBe('game.exp.use')
  })

  it('buys the point straight from the little card through use-exp', async () => {
    const onDone = vi.fn()
    render(<ExperienceStatCard row={AFFORDABLE} experience={40} story={STORY}
                               matchUuid="m1" accessToken="tok" onDone={onDone} />)
    fireEvent.click(screen.getByTestId('action-btn'))
    await waitFor(() => expect(useExp).toHaveBeenCalledWith('m1', 'dex', 'tok'))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ stat: 'dex', statAfter: 11 }))
  })

  it('reports a failed purchase through onError, never through onDone', async () => {
    const onDone = vi.fn()
    const onError = vi.fn()
    const failure = { response: { data: { error: 'NOT_ENOUGH_EXP' } } }
    useExp.mockRejectedValue(failure)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ExperienceStatCard row={AFFORDABLE} story={STORY}
                               matchUuid="m1" accessToken="tok" onDone={onDone} onError={onError} />)
    fireEvent.click(screen.getByTestId('action-btn'))
    await waitFor(() => expect(onError).toHaveBeenCalledWith(failure))
    expect(onDone).not.toHaveBeenCalled()
  })

  it('does nothing without a match, and never runs two purchases at once', async () => {
    render(<ExperienceStatCard row={AFFORDABLE} story={STORY} />)
    fireEvent.click(screen.getByTestId('action-btn'))
    fireEvent.click(screen.getByTestId('action-btn'))
    await waitFor(() => expect(useExp).not.toHaveBeenCalled())
  })

  it('locks a point the experience held cannot pay for: no button, the reason, no After', () => {
    render(<ExperienceStatCard row={TOO_DEAR} experience={5} story={STORY} matchUuid="m1" />)
    expect(screen.getByTestId('locked').textContent).toBe('true')
    expect(screen.getByTestId('lock-info').textContent).toBe('game.exp.reason.NOT_ENOUGH_EXP')
    expect(capturedProps.onAction).toBeUndefined()
    expect(screen.queryByTestId('action-btn')).toBeNull()
    expect(faceBadges()).toEqual(['game.exp.current:10', 'game.exp.held:5', 'game.exp.cost:23'])
  })

  it('locks a capped stat and writes "Max" where the price would be', () => {
    render(<ExperienceStatCard row={CAPPED} story={STORY} matchUuid="m1" />)
    expect(screen.getByTestId('lock-info').textContent).toBe('game.exp.reason.MAX_STAT_VALUE')
    expect(capturedProps.card.awesomeIcon).toBe('fas fa-brain')
    expect(capturedProps.onAction).toBeUndefined()
    expect(faceBadges()).toEqual(['game.exp.current:12', 'game.exp.held:0', 'game.exp.cost:game.exp.atMax'])
  })
})

describe('ExperienceCards (Step 38)', () => {
  it('renders one card per stat, the affordable ones first, each told the experience held', () => {
    const playerStats = { experience: 12, dexterity: 10, intelligence: 12, constitution: 4,
                          expCosts: { dex: 23, int: null, cos: 11 } }
    render(<ExperienceCards playerStats={playerStats} story={STORY} matchUuid="m1" />)
    const titles = screen.getAllByTestId('card-title').map(n => n.textContent)
    expect(titles).toEqual(['game.stats.constitution', 'game.stats.dexterity', 'game.stats.intelligence'])
    expect(screen.getAllByTestId('locked').map(n => n.textContent)).toEqual(['false', 'true', 'true'])
    // constitution: 4 now, 12 held, costs 11 → 5 once bought
    expect(screen.getAllByTestId('face')[0].textContent).toContain('game.exp.after:5')
  })
})

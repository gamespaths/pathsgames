import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

// Card is exercised in its own suite; here it is a stub surfacing what this reading decides:
// which card won, at which variant, which badges rode along, and where the forward arrow goes.
//
// NOTE: the component currently comments out the preview props and the whole dismiss card
// (the "never remove" block), so the lens/dismiss cases are gone from this suite. The stub
// keeps its onPreview/onAction branches: restore those props and the cases come straight
// back — see "the page offers no lens while preview is commented out" below.
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, entityType, variant, onPreview, onAction, onForward, hidePreview,
             statItemsToPageContent }) => (
    <div data-testid={`card-${entityType}`}>
      <span data-testid="card-title">{card?.title}</span>
      <span data-testid="card-variant">{variant}</span>
      <span data-testid="hide-preview">{String(!!hidePreview)}</span>
      <span data-testid="stat-items">
        {(statItemsToPageContent ?? []).map(i => `${i.key}${i.value}`).join(',')}
      </span>
      {onPreview && <button data-testid="preview-btn" onClick={() => onPreview()}>i</button>}
      {onAction && <button data-testid="dismiss-btn" onClick={onAction}>ok</button>}
      {onForward && <button data-testid="forward-btn" onClick={onForward}>→</button>}
    </div>
  ),
}))

import AutomaticEvents, { firstEffectCard } from '../features/gameplay/cards/AutomaticEvents'

const STORY = { uuid: 's1' }
const ME = 'char-me'

const effect = (title, over = {}) => ({
  eventUuid: 'evt-a', effectUuid: `eff-${title}`, statistic: null, value: null,
  target: 'ONLY_ONE', targetClass: null, characterUuids: [ME], card: { title }, ...over,
})

const FULL_WITH_EFFECTS = {
  trigger: 'COUNTER_ZERO', idLocation: 90001, eventUuid: 'evt-a', clock: 7, visibility: 'FULL',
  card: { title: 'The fuse burns out' },
  cardLocation: { title: 'The old mill' },
  cardEffects: [
    effect('You feel weaker', { statistic: 'energy', value: -3 }),
    effect('And then colder', { statistic: 'life', value: -1 }),
  ],
}
const NAMED_NO_EFFECTS = {
  trigger: 'COUNTER_ZERO', idLocation: 90002, eventUuid: 'evt-b', clock: 7, visibility: 'NAMED',
  card: { title: 'A door swings open' },
  cardLocation: { title: 'The cellar' },
  cardEffects: [],
}
const ANONYMOUS = {
  trigger: 'COUNTER_ZERO', idLocation: 90003, eventUuid: 'evt-c', clock: 7,
  visibility: 'ANONYMOUS', card: null, cardLocation: null,
  cardEffects: [effect('never leaves the server', { statistic: 'life', value: -9 })],
}

beforeEach(() => vi.clearAllMocks())

describe('AutomaticEvents (Step 33, v0.33.1)', () => {
  it('reads one notice at a time, not a stack', () => {
    render(<AutomaticEvents story={STORY} items={[FULL_WITH_EFFECTS, NAMED_NO_EFFECTS]}
      onPreview={vi.fn()} onDismiss={vi.fn()} playerUuid={ME} />)
    expect(screen.getAllByTestId('card-automatic-event')).toHaveLength(1)
    expect(screen.getByTestId('card-title')).toHaveTextContent('You feel weaker')
  })

  it('the forward arrow walks to the next notice', () => {
    const onDismiss = vi.fn()
    render(<AutomaticEvents story={STORY} items={[FULL_WITH_EFFECTS, NAMED_NO_EFFECTS]}
      onPreview={vi.fn()} onDismiss={onDismiss} playerUuid={ME} />)

    fireEvent.click(screen.getByTestId('forward-btn'))

    expect(screen.getByTestId('card-title')).toHaveTextContent('A door swings open')
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('the forward arrow on the LAST notice closes the whole reading', () => {
    const onDismiss = vi.fn()
    render(<AutomaticEvents story={STORY} items={[NAMED_NO_EFFECTS]}
      onPreview={vi.fn()} onDismiss={onDismiss} playerUuid={ME} />)

    fireEvent.click(screen.getByTestId('forward-btn'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('shows the FIRST effect card, not the event card, when the event applied something', () => {
    render(<AutomaticEvents story={STORY} items={[FULL_WITH_EFFECTS]}
      onPreview={vi.fn()} onDismiss={vi.fn()} playerUuid={ME} />)
    expect(screen.getByTestId('card-title')).toHaveTextContent('You feel weaker')
    expect(screen.queryByText('The fuse burns out')).not.toBeInTheDocument()
  })

  it('falls back to the event card when there are no effects', () => {
    render(<AutomaticEvents story={STORY} items={[NAMED_NO_EFFECTS]}
      onPreview={vi.fn()} onDismiss={vi.fn()} playerUuid={ME} />)
    expect(screen.getByTestId('card-title')).toHaveTextContent('A door swings open')
  })

  it('ignores cardLocation entirely — the place is not this list to tell', () => {
    render(<AutomaticEvents story={STORY} items={[FULL_WITH_EFFECTS]}
      onPreview={vi.fn()} onDismiss={vi.fn()} playerUuid={ME} />)
    expect(screen.queryByText('The old mill')).not.toBeInTheDocument()
  })

  it('falls back to a generic notice when the entry carries no card at all', () => {
    render(<AutomaticEvents story={STORY}
      items={[{ eventUuid: 'evt-d', visibility: 'FULL' }]}
      onPreview={vi.fn()} onDismiss={vi.fn()} playerUuid={ME} />)
    expect(screen.getByTestId('card-title')).toHaveTextContent('game.automaticEvents.title')
  })

  it('badges the statistics the effects changed', () => {
    render(<AutomaticEvents story={STORY} items={[FULL_WITH_EFFECTS]}
      onPreview={vi.fn()} onDismiss={vi.fn()} playerUuid={ME} />)
    expect(screen.getByTestId('stat-items')).toHaveTextContent('energy-3,life-1')
  })

  it('an entry whose effects changed nothing carries no badges', () => {
    render(<AutomaticEvents story={STORY} items={[NAMED_NO_EFFECTS]}
      onPreview={vi.fn()} onDismiss={vi.fn()} playerUuid={ME} />)
    expect(screen.getByTestId('stat-items')).toBeEmptyDOMElement()
  })

  it('renders the notice as a reading page', () => {
    render(<AutomaticEvents story={STORY} items={[FULL_WITH_EFFECTS]}
      onPreview={vi.fn()} onDismiss={vi.fn()} playerUuid={ME} />)
    expect(screen.getByTestId('card-variant')).toHaveTextContent('page')
  })

  it('an ANONYMOUS notice names nothing and badges nothing', () => {
    // Badges would say what happened in a place the player may not know about — and the
    // server does send the effects when it wrongly thinks it may. The board withholds them.
    render(<AutomaticEvents story={STORY} items={[ANONYMOUS]}
      onPreview={vi.fn()} onDismiss={vi.fn()} playerUuid={ME} />)
    const entry = screen.getByTestId('card-automatic-event')
    expect(entry).toHaveTextContent('game.automaticEvents.anonymous')
    expect(screen.queryByText('never leaves the server')).not.toBeInTheDocument()
    expect(screen.getByTestId('stat-items')).toBeEmptyDOMElement()
  })

  it('the page offers no lens while preview is commented out', () => {
    // Documents the CURRENT shape, not the intended one: the component's preview props and
    // its dismiss card are commented out. When they come back, this case goes and the lens /
    // dismiss / hidePreview cases return — the Card stub still exposes preview-btn and
    // dismiss-btn for exactly that.
    render(<AutomaticEvents story={STORY} items={[FULL_WITH_EFFECTS, ANONYMOUS]}
      onPreview={vi.fn()} onDismiss={vi.fn()} playerUuid={ME} />)
    expect(screen.queryByTestId('preview-btn')).toBeNull()
    expect(screen.queryByTestId('dismiss-btn')).toBeNull()
    expect(screen.queryByTestId('card-automatic-event-done')).toBeNull()
  })

  it('an empty list renders nothing at all', () => {
    render(<AutomaticEvents story={STORY} items={[]} onPreview={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.queryAllByTestId('card-automatic-event')).toHaveLength(0)
  })
})

describe('firstEffectCard', () => {
  it('takes the first effect that actually carries a card', () => {
    expect(firstEffectCard({ cardEffects: [{ card: null }, effect('Second')] }))
      .toEqual({ title: 'Second' })
  })

  it('is null for no effects, and for effects with no cards', () => {
    expect(firstEffectCard({ cardEffects: [] })).toBeNull()
    expect(firstEffectCard({})).toBeNull()
    expect(firstEffectCard({ cardEffects: [{ card: null }] })).toBeNull()
  })
})

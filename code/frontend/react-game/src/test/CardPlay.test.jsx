import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// Step 15 — Card / CardButtons and the play: the main action and "Do" play the card; the (i) and the
// secondary buttons never do; with no play id or no provider the buttons are exactly today's.

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../context/PolicyBookContext', () => ({ usePolicyBook: () => ({ openPolicyBook: vi.fn() }) }))
const play = vi.hoisted(() => ({ api: null, state: null }))
vi.mock('../features/gameplay/play/PlayContext', () => ({
  usePlay: () => play.api,
  usePlayState: () => play.state,
}))

import Card from '../components/layout/Card'
import CardButtons from '../components/layout/CardButtons'

beforeEach(() => {
  play.api = { begin: vi.fn(), cancel: vi.fn() }
  play.state = null
})

describe('CardButtons — play', () => {
  it('the main action begins the play with the card root, then cancels a play still lifting once it settles', async () => {
    let settle
    const onAction = vi.fn(() => new Promise(res => { settle = res }))
    render(<Card card={{ title: 'Move', urlImage: 'move.png' }} playId="movement:l2" onAction={onAction} actionLabel="go"
      testId="mv" />)
    const root = screen.getByTestId('mv-action').closest('.pg-card')
    fireEvent.click(screen.getByTestId('mv-action'))
    // v1.15.0 — the title and picture the card leaves on the face-up pile
    expect(play.api.begin).toHaveBeenCalledWith('movement:l2', root, { title: 'Move', image: 'move.png' })
    expect(play.api.cancel).not.toHaveBeenCalled()
    await act(async () => { settle() })
    expect(play.api.cancel).toHaveBeenCalledTimes(1)
  })

  it('a reading page plays from its own root, with its alternative picture when it has no image', () => {
    render(<Card variant="page" card={{ title: 'Move', alternativeImage: 'alt.png' }} playId="movement:l2" onAction={vi.fn()}
      actionLabel="go" testId="mv" />)
    fireEvent.click(screen.getByTestId('mv-action'))
    expect(play.api.begin).toHaveBeenCalledWith('movement:l2', document.querySelector('.book-page-content'),
      { title: 'Move', image: 'alt.png' })
  })

  it('"Do" (select) begins too, passes the click on, and cancels in finally (also on a refusal)', async () => {
    const onSelect = vi.fn(() => Promise.reject(new Error('refused')))
    render(<Card card={{ title: 'Option' }} playId="choice:c1" onSelect={onSelect} selectLabel="do" testId="opt" />)
    await act(async () => { fireEvent.click(screen.getByTestId('opt-select')) })
    expect(play.api.begin).toHaveBeenCalledWith('choice:c1', screen.getByTestId('opt-select').closest('.pg-card'),
      { title: 'Option', image: null })
    expect(onSelect.mock.calls[0][0]).toHaveProperty('type', 'click')
    expect(play.api.cancel).toHaveBeenCalled()
  })

  it('the (i) and the secondary buttons never play', async () => {
    const onPreview = vi.fn()
    const drop = vi.fn()
    render(<Card card={{ title: 'Potion' }} playId="item:i1" onPreview={onPreview} flagInformationCard
      actionsList={[{ label: 'drop', icon: 'fa-trash', onAction: drop, testId: 'drop' }]} testId="it" />)
    fireEvent.click(screen.getByTestId('it-info'))
    await act(async () => { fireEvent.click(screen.getByTestId('drop')) })
    expect(onPreview).toHaveBeenCalled()
    expect(drop).toHaveBeenCalled()
    expect(play.api.begin).not.toHaveBeenCalled()
    expect(play.api.cancel).not.toHaveBeenCalled()
  })

  it('no play id: a plain click, nothing begins', async () => {
    const onAction = vi.fn()
    const onSelect = vi.fn()
    render(<>
      <CardButtons name="a" onAction={onAction} actionLabel="act" testId="a" />
      <CardButtons name="b" onSelect={onSelect} selectLabel="sel" testId="b" />
    </>)
    await act(async () => { fireEvent.click(screen.getByTestId('a-action')) })
    fireEvent.click(screen.getByTestId('b-select'))
    expect(onAction).toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalled()
    expect(play.api.begin).not.toHaveBeenCalled()
    expect(play.api.cancel).not.toHaveBeenCalled()
  })

  it('no provider (outside a game book): today\'s buttons even with a play id', async () => {
    play.api = null
    const onSelect = vi.fn()
    render(<CardButtons name="b" playId="choice:c1" onSelect={onSelect} selectLabel="sel" testId="b" />)
    fireEvent.click(screen.getByTestId('b-select'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

describe('Card — play classes, special components kept', () => {
  it('the played small card lifts, the others dim; the test ids and the (i) stay', () => {
    play.state = { playId: 'action:a1', phase: 'lift', small: true }
    render(<>
      <Card card={{ title: 'A' }} playId="action:a1" onPreview={vi.fn()} flagInformationCard testId="a"
        childrenIntoImage={<span data-testid="badge">3</span>} additionalCardClasses="extra" />
      <Card card={{ title: 'B' }} onPreview={vi.fn()} flagInformationCard testId="b" />
      <Card variant="page" card={{ title: 'Page' }} />
    </>)
    const a = screen.getByTestId('a-info').closest('.pg-card')
    expect(a).toHaveClass('is-playing', 'extra')
    expect(screen.getByTestId('b-info').closest('.pg-card')).toHaveClass('is-dimmed')
    expect(document.querySelector('.book-page-content')).not.toHaveClass('is-dimmed')
    expect(screen.getByTestId('badge')).toBeInTheDocument()
  })

  it('no play: the root class string is exactly today\'s', () => {
    render(<Card card={{ title: 'A' }} additionalCardClasses="extra" testId="a" onPreview={vi.fn()} flagInformationCard />)
    expect(screen.getByTestId('a-info').closest('.pg-card').className).toBe('pg-card pg-card--grid extra')
  })
})

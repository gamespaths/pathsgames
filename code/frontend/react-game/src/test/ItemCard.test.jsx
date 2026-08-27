import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

const useItem = vi.fn()
const dropItem = vi.fn()
vi.mock('@/api/matches', () => ({
  useItem: (...args) => useItem(...args),
  dropItem: (...args) => dropItem(...args),
}))

let capturedProps = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    capturedProps = props
    const { card, onPreview, onAction, entityType, flagInformationCard, locked, lockInfo } = props
    return (
      <div data-testid="item-card">
        <span data-testid="card-title">{card?.title}</span>
        <span data-testid="entity-type">{entityType}</span>
        <span data-testid="info-flag">{String(!!flagInformationCard)}</span>
        <span data-testid="locked">{String(!!locked)}</span>
        <span data-testid="lock-info">{lockInfo ?? ''}</span>
        {onPreview && <button data-testid="preview-btn" onClick={onPreview}>preview</button>}
        {onAction && <button data-testid="action-btn" onClick={onAction}>do</button>}
      </div>
    )
  },
}))

import ItemCard from '../features/gameplay/cards/ItemCard'

const STORY = { uuid: 's1', title: 'Story' }

/** One inventory ROW, as /inventory and /info players[].items both project it. */
const ITEM = {
  uuid: 'row-1', itemUuid: 'item-900', name: 'Potion', weight: 3, amount: 2,
  state: 'ACTIVE', idCard: 77, isConsumabile: true,
  card: { title: 'Healing Potion', description: 'It smells of herbs', awesomeIcon: 'fas fa-flask' },
}

const CARRIED_ONLY = { ...ITEM, uuid: 'row-2', isConsumabile: false }

/** The preview's additionalProps: onPreview(card, type, lockReason, stats, modal, props, side) */
function previewProps(onPreview) {
  fireEvent.click(screen.getByTestId('preview-btn'))
  return onPreview.mock.calls[0][5]
}

/** The props of the MOST RECENT preview — i.e. after the card has re-rendered. */
function latestPreviewProps(onPreview) {
  fireEvent.click(screen.getByTestId('preview-btn'))
  return onPreview.mock.calls[onPreview.mock.calls.length - 1][5]
}

describe('ItemCard', () => {
  beforeEach(() => {
    capturedProps = null
    useItem.mockReset()
    dropItem.mockReset()
    useItem.mockResolvedValue({ status: 'APPLIED', refreshRecommended: true })
    dropItem.mockResolvedValue({ amountDropped: 2 })
  })

  it('renders the item card as an information card with entityType "item" and no label prop', () => {
    render(<ItemCard item={ITEM} story={STORY} onPreview={vi.fn()} />)

    expect(screen.getByTestId('card-title').textContent).toBe('Healing Potion')
    expect(screen.getByTestId('entity-type').textContent).toBe('item')
    expect(screen.getByTestId('info-flag').textContent).toBe('true')
    // The no-label-prop-in-card convention: the hint rides on lockInfo.
    expect(capturedProps.label).toBeUndefined()
  })

  it('falls back to the item name and a box icon when the backend sent no card', () => {
    const onPreview = vi.fn()
    render(<ItemCard item={{ ...ITEM, card: undefined }} story={STORY} onPreview={onPreview} />)

    expect(screen.getByTestId('card-title').textContent).toBe('Potion')
    expect(capturedProps.card.awesomeIcon).toBe('fas fa-box')
    // The preview gets the same fallback rather than a null card.
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][0]).toMatchObject({ title: 'Potion' })
  })

  it('falls back to the item uuid when there is neither a card nor a name', () => {
    render(<ItemCard item={{ uuid: 'row-1', itemUuid: 'item-900' }} story={STORY} onPreview={vi.fn()} />)
    expect(screen.getByTestId('card-title').textContent).toBe('item-900')
  })

  it("uses the item's own icon when its card carries one", () => {
    const withIcon = { ...ITEM, card: { ...ITEM.card, awesomeIcon: 'fas fa-flask' } }

    render(<ItemCard item={withIcon} story={STORY} onPreview={vi.fn()} />)

    expect(capturedProps.actionIcon).toBe('fas fa-flask')
  })

  it('falls back to a neutral "activate" icon when the card carries none', () => {
    // The fallback lands on anything from a potion to a scroll, so it stays generic:
    // it says something is about to happen, not what the thing is.
    const noIcon = { ...ITEM, card: { title: 'Healing Potion' } }

    render(<ItemCard item={noIcon} story={STORY} onPreview={vi.fn()} />)

    expect(capturedProps.actionIcon).toBe('fas fa-play')
  })

  it('writes the carried amount as xN, with no icon beside it', () => {
    const onPreview = vi.fn()
    render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview} />)

    // The badges ride on the card image; the amount one only appears above 1.
    const badges = capturedProps.childrenIntoImage.props.items
    const quantity = badges.find(b => b.key === 'amount')
    expect(quantity).toBeTruthy()
    // A plain letter, not the × sign: that glyph renders smaller than the digits.
    expect(quantity.prefix).toBe('x')
    // The value stays a bare number: BonusBadgeList's zero-filter parses it.
    expect(quantity.value).toBe('2')
    expect(Number.isFinite(Number(quantity.value))).toBe(true)
  })

  it('shows no amount badge for a single item', () => {
    render(<ItemCard item={{ ...ITEM, amount: 1 }} story={STORY} onPreview={vi.fn()} />)

    const badges = capturedProps.childrenIntoImage.props.items
    expect(badges.find(b => b.key === 'amount')).toBeUndefined()
    // The weight is still there, counted for the whole row.
    expect(badges.find(b => b.key === 'weight')).toBeTruthy()
  })

  it('puts the badges in the DESCRIPTION, not on the action button', () => {
    const onPreview = vi.fn()
    render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview} />)

    fireEvent.click(screen.getByTestId('preview-btn'))

    // 4th argument is `statistics`, which Card renders inside book-page-desc.
    const [, , , stats, , props] = onPreview.mock.calls[0]
    expect(stats.map(b => b.key).sort()).toEqual(['amount', 'weight'])
    expect(props.actionLabelChildren).toBeUndefined()
  })

  it('drops the x prefix in the description, where the label already says it', () => {
    const onPreview = vi.fn()
    render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview} />)

    fireEvent.click(screen.getByTestId('preview-btn'))

    const stats = onPreview.mock.calls[0][3]
    const quantity = stats.find(b => b.key === 'amount')
    // "Amount: 2", not "Amount: x2" — the x belongs on the card face, where there is no
    // room for a label. The badges on the face still carry it.
    expect(quantity.prefix).toBeUndefined()
    expect(quantity.label).toBeTruthy()
    expect(capturedProps.childrenIntoImage.props.items.find(b => b.key === 'amount').prefix)
      .toBe('x')
  })

  it('promises the effects using it would apply (Step 35)', () => {
    const onPreview = vi.fn()
    const potion = { ...ITEM, effects: [
      { statistic: 'life', value: 3 },
      { statistic: 'sad', value: -1 },
    ] }
    render(<ItemCard item={potion} story={STORY} onPreview={onPreview} />)

    fireEvent.click(screen.getByTestId('preview-btn'))

    const stats = onPreview.mock.calls[0][3]
    // Weight and amount first — what the row IS — then what using it would do.
    expect(stats.map(b => b.key)).toEqual(['amount', 'weight', 'life', 'sadness'])
    expect(stats.find(b => b.key === 'life').value).toBe('+3')
    expect(stats.find(b => b.key === 'sadness').value).toBe('-1')
  })

  it('promises nothing for an item that can only be carried', () => {
    const onPreview = vi.fn()
    // The engine refuses to use it at all, so its effect rows can never fire.
    const relic = { ...CARRIED_ONLY, effects: [{ statistic: 'life', value: 3 }] }
    render(<ItemCard item={relic} story={STORY} onPreview={onPreview} />)

    fireEvent.click(screen.getByTestId('preview-btn'))

    const stats = onPreview.mock.calls[0][3]
    expect(stats.map(b => b.key).sort()).toEqual(['amount', 'weight'])
  })

  it('refuses the use when the bag holds fewer units than one usage spends (v0.35.1)', () => {
    const onPreview = vi.fn()
    // amountUse 2 against 1 carried: the engine would answer ITEM_NOT_ENOUGH, so the board
    // does not offer the button at all.
    const scarce = { ...ITEM, amount: 1, amountUse: 2 }
    render(<ItemCard item={scarce} story={STORY} onPreview={onPreview} />)

    expect(screen.getByTestId('locked').textContent).toBe('true')
    expect(screen.getByTestId('lock-info').textContent).toBe('game.item.reason.ITEM_NOT_ENOUGH')

    const preview = previewProps(onPreview)
    expect(preview.onAction).toBeUndefined()
    // The figures ride on the sentence: the i18n helper cannot interpolate them.
    expect(preview.extraContent).toContain('(1/2)')
  })

  it('offers the use again as soon as the bag holds enough', () => {
    const onPreview = vi.fn()
    const enough = { ...ITEM, amount: 2, amountUse: 2 }
    render(<ItemCard item={enough} story={STORY} onPreview={onPreview} />)

    expect(screen.getByTestId('locked').textContent).toBe('false')
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][5].onAction).toBeTypeOf('function')
  })

  it('a non-consumable still says CARRIED, not "too few"', () => {
    // Two refusals, two reasons: the units one is only reachable for an item you may use.
    const onPreview = vi.fn()
    render(<ItemCard item={{ ...CARRIED_ONLY, amount: 1, amountUse: 5 }} story={STORY}
      onPreview={onPreview} />)

    expect(screen.getByTestId('lock-info').textContent)
      .toBe('game.item.reason.ITEM_NOT_CONSUMABLE')
  })

  it('shows the cap beside the amount, and the cost of a usage in the description', () => {
    const onPreview = vi.fn()
    const capped = { ...ITEM, amount: 2, maxPerCharacter: 3, amountUse: 2 }
    render(<ItemCard item={capped} story={STORY} onPreview={onPreview} />)

    const face = capturedProps.childrenIntoImage.props.items
    expect(face.find(b => b.key === 'amount').value).toBe('2/3')
    fireEvent.click(screen.getByTestId('preview-btn'))
    const stats = onPreview.mock.calls[0][3]
    expect(stats.find(b => b.key === 'amount').value).toBe('2/3')
    expect(stats.find(b => b.key === 'perUse').value).toBe('2')
  })

  it('a locked item explains itself without repeating the badges', () => {
    const onPreview = vi.fn()
    render(<ItemCard item={CARRIED_ONLY} story={STORY} onPreview={onPreview} />)

    fireEvent.click(screen.getByTestId('preview-btn'))

    const [, , , stats, , props] = onPreview.mock.calls[0]
    // The badges ride on `statistics` here too, so extraContent is only the reason.
    expect(stats.length).toBeGreaterThan(0)
    expect(props.extraContent).toBe('game.item.reasonFull.ITEM_NOT_CONSUMABLE')
  })

  it('previews on the right by default and passes the item card through', () => {
    const onPreview = vi.fn()
    render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview} />)

    fireEvent.click(screen.getByTestId('preview-btn'))

    const call = onPreview.mock.calls[0]
    expect(call[0]).toBe(ITEM.card)
    expect(call[1]).toBe('item')
    expect(call[6]).toBe('right')
  })

  it('honours an explicit previewSide', () => {
    const onPreview = vi.fn()
    render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview} previewSide="left" />)

    fireEvent.click(screen.getByTestId('preview-btn'))

    expect(onPreview.mock.calls[0][6]).toBe('left')
  })

  describe('a consumable item', () => {
    it('is not locked and offers "use" as the preview action', () => {
      const onPreview = vi.fn()
      render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview} />)

      expect(screen.getByTestId('locked').textContent).toBe('false')
      const props = previewProps(onPreview)
      // A single-unit usage says nothing extra: that is every item before v0.35.1.
      expect(props.actionLabel).toBe('game.item.use')
      expect(typeof props.onAction).toBe('function')
    })

    it('calls use-item with the INVENTORY ROW uuid, never the story item uuid', async () => {
      const onPreview = vi.fn()
      const onDone = vi.fn()
      render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview}
                       matchUuid="m1" accessToken="tok" onDone={onDone} />)

      await previewProps(onPreview).onAction()

      expect(useItem).toHaveBeenCalledWith('m1', 'row-1', 'tok')
      await waitFor(() => expect(onDone).toHaveBeenCalledWith(
        { status: 'APPLIED', refreshRecommended: true }))
    })

    it('reports a failed use through onError and never through onDone', async () => {
      const onPreview = vi.fn()
      const onDone = vi.fn()
      const onError = vi.fn()
      const failure = { response: { data: { error: 'ITEM_CLASS_PROHIBITED' } } }
      useItem.mockRejectedValueOnce(failure).mockRejectedValueOnce({ message: 'network down' })
      render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview}
                       matchUuid="m1" accessToken="tok" onDone={onDone} onError={onError} />)

      await previewProps(onPreview).onAction()

      await waitFor(() => expect(onError).toHaveBeenCalledWith(failure))
      expect(onDone).not.toHaveBeenCalled()

      // A transport failure carries no backend code — the message is the only thing to log.
      await latestPreviewProps(onPreview).onAction()
      await waitFor(() => expect(onError).toHaveBeenCalledTimes(2))
    })
  })

  describe('a non-consumable item', () => {
    it('renders locked, with the reason on lockInfo', () => {
      render(<ItemCard item={CARRIED_ONLY} story={STORY} onPreview={vi.fn()} />)

      expect(screen.getByTestId('locked').textContent).toBe('true')
      expect(screen.getByTestId('lock-info').textContent)
        .toBe('game.item.reason.ITEM_NOT_CONSUMABLE')
      expect(capturedProps.label).toBeUndefined()
    })

    it('offers no use action, and explains itself in the preview', () => {
      const onPreview = vi.fn()
      render(<ItemCard item={CARRIED_ONLY} story={STORY} onPreview={onPreview} />)

      fireEvent.click(screen.getByTestId('preview-btn'))
      expect(onPreview.mock.calls[0][2]).toBe('game.item.reasonFull.ITEM_NOT_CONSUMABLE')
      expect(onPreview.mock.calls[0][5].onAction).toBeUndefined()
    })

    it('is still droppable — that is the whole point of carrying one', async () => {
      const onPreview = vi.fn()
      const onDropped = vi.fn()
      render(<ItemCard item={CARRIED_ONLY} story={STORY} onPreview={onPreview}
                       matchUuid="m1" accessToken="tok" onDropped={onDropped} />)

      const props = previewProps(onPreview)
      expect(props.actionsList).toHaveLength(1)
      await props.actionsList[0].onAction()

      expect(dropItem).toHaveBeenCalledWith('m1', 'row-2', 'tok')
      await waitFor(() => expect(onDropped).toHaveBeenCalled())
    })
  })

  it('offers drop alongside use on a consumable item', async () => {
    const onPreview = vi.fn()
    const onDropped = vi.fn()
    render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview}
                     matchUuid="m1" accessToken="tok" onDropped={onDropped} />)

    const props = previewProps(onPreview)
    await props.actionsList[0].onAction()

    expect(dropItem).toHaveBeenCalledWith('m1', 'row-1', 'tok')
  })

  it('reports a failed drop through onError', async () => {
    const onPreview = vi.fn()
    const onError = vi.fn()
    const failure = { message: 'boom' }
    dropItem.mockRejectedValue(failure)
    render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview}
                     matchUuid="m1" accessToken="tok" onError={onError} />)

    await previewProps(onPreview).actionsList[0].onAction()

    await waitFor(() => expect(onError).toHaveBeenCalledWith(failure))
  })

  it('refuses a second use while the first is still in flight', async () => {
    const onPreview = vi.fn()
    // Never resolves: the call stays open for the whole test, which is the point.
    useItem.mockImplementation(() => new Promise(() => {}))
    render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview}
                     matchUuid="m1" accessToken="tok" onDone={vi.fn()} />)

    await act(async () => { previewProps(onPreview).onAction() })

    // Re-open the preview: the card has re-rendered with running=true, so the props it
    // hands over now are the ones a second click would really use.
    const latest = latestPreviewProps(onPreview)
    await act(async () => { latest.onAction() })
    expect(useItem).toHaveBeenCalledTimes(1)
    // Dropping is locked out for the same reason.
    await act(async () => { latest.actionsList[0].onAction() })
    expect(dropItem).not.toHaveBeenCalled()
  })

  it('does nothing without a match uuid or an item uuid', async () => {
    const onPreview = vi.fn()
    render(<ItemCard item={{ ...ITEM, uuid: undefined }} story={STORY} onPreview={onPreview}
                     matchUuid="m1" accessToken="tok" />)

    const props = previewProps(onPreview)
    await props.onAction()
    await props.actionsList[0].onAction()

    expect(useItem).not.toHaveBeenCalled()
    expect(dropItem).not.toHaveBeenCalled()
  })

  describe('a bag over its capacity', () => {
    const OVER = { weight: 31, weightMax: 30 }

    it('puts the bin on the row itself, beside the (i)', () => {
      render(<ItemCard item={ITEM} story={STORY} onPreview={vi.fn()} playerStats={OVER} />)

      expect(capturedProps.actionsList).toHaveLength(1)
      expect(capturedProps.actionsList[0].icon).toContain('fa-trash')
      expect(capturedProps.actionsList[0].ariaLabel).toBe('game.item.drop')
      expect(capturedProps.actionListClass).toBe('display-grid2')
    })

    it('takes the word "use" off the (i) to make room for the bin', () => {
      render(<ItemCard item={ITEM} story={STORY} onPreview={vi.fn()} playerStats={OVER} />)
      // The label is hidden, not removed: it stays the preview button's aria-label.
      expect(capturedProps.infoLabelClassName).toBe('display-none')
      expect(capturedProps.infoLabel).toBe('game.item.use')
    })

    it('the row bin opens the big card instead of dropping on the spot', async () => {
      const onPreview = vi.fn()
      render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview} playerStats={OVER}
        matchUuid="m1" accessToken="tok" onDropped={vi.fn()} />)

      await act(async () => { await capturedProps.actionsList[0].onAction() })

      // Dropping is irreversible: the row bin is a way to the page, never the drop itself.
      expect(dropItem).not.toHaveBeenCalled()
      expect(onPreview).toHaveBeenCalledTimes(1)
      expect(onPreview.mock.calls[0][1]).toBe('item')
      // And the page it opens is the one the (i) opens, bin and all.
      expect(onPreview.mock.calls[0][5].actionsList[0].icon).toContain('fa-trash')
    })

    it('gives a carried-only row no bin: that one is dropped from its own page', () => {
      render(<ItemCard item={CARRIED_ONLY} story={STORY} onPreview={vi.fn()} playerStats={OVER} />)

      expect(screen.getByTestId('locked').textContent).toBe('true')
      expect(capturedProps.actionsList).toEqual([])
      expect(capturedProps.infoLabelClassName).toBeUndefined()
    })

    it('leaves the row alone at or under the limit — the bin stays in the preview', () => {
      for (const stats of [{ weight: 30, weightMax: 30 }, { weight: 3, weightMax: 30 }, {}, undefined]) {
        render(<ItemCard item={ITEM} story={STORY} onPreview={vi.fn()} playerStats={stats} />)
        expect(capturedProps.actionsList).toEqual([])
        expect(capturedProps.actionListClass).toBeNull()
      }
    })
  })

  it('the bin on the BIG card says what it does, and drops the row for real', async () => {
    const onPreview = vi.fn()
    const onDropped = vi.fn()
    render(<ItemCard item={ITEM} story={STORY} onPreview={onPreview}
      matchUuid="m1" accessToken="tok" onDropped={onDropped} />)

    const bin = previewProps(onPreview).actionsList[0]
    expect(bin.label).toBe('game.item.drop')
    expect(bin.icon).toContain('fa-trash')

    await act(async () => { await bin.onAction() })
    expect(dropItem).toHaveBeenCalledWith('m1', 'row-1', 'tok')
    await waitFor(() => expect(onDropped).toHaveBeenCalled())
  })

  describe('how many units the big card promises to move', () => {
    it('spells the usage cost out on the use button', () => {
      const onPreview = vi.fn()
      render(<ItemCard item={{ ...ITEM, amount: 5, amountUse: 2 }} story={STORY} onPreview={onPreview} />)
      expect(previewProps(onPreview).actionLabel).toBe('game.item.use x2')
    })

    it('spells the drop size out on the bin button', () => {
      const onPreview = vi.fn()
      render(<ItemCard item={{ ...ITEM, amount: 5, amountDrop: 3 }} story={STORY} onPreview={onPreview} />)
      expect(previewProps(onPreview).actionsList[0].label).toBe('game.item.drop x3')
    })

    it('never promises to drop more than is held', () => {
      const onPreview = vi.fn()
      render(<ItemCard item={{ ...ITEM, amount: 2, amountDrop: 10 }} story={STORY} onPreview={onPreview} />)
      expect(previewProps(onPreview).actionsList[0].label).toBe('game.item.drop x2')
    })

    it('says nothing when a single unit moves — on either button', () => {
      const onPreview = vi.fn()
      render(<ItemCard item={{ ...ITEM, amount: 1, amountUse: 1, amountDrop: 1 }} story={STORY} onPreview={onPreview} />)

      const props = previewProps(onPreview)
      expect(props.actionLabel).toBe('game.item.use')
      expect(props.actionsList[0].label).toBe('game.item.drop')
    })

    it('says nothing on a drop capped down to one by what is held', () => {
      const onPreview = vi.fn()
      render(<ItemCard item={{ ...ITEM, amount: 1, amountDrop: 5 }} story={STORY} onPreview={onPreview} />)
      expect(previewProps(onPreview).actionsList[0].label).toBe('game.item.drop')
    })

    it('keeps the bare word on the row bin: no room, and the page says it anyway', () => {
      render(<ItemCard item={{ ...ITEM, amountDrop: 3 }} story={STORY} onPreview={vi.fn()}
        playerStats={{ weight: 31, weightMax: 30 }} />)
      expect(capturedProps.actionsList[0].label).toBe('')
    })
  })
})

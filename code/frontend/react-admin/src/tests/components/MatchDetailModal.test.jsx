import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../api/storyApi', () => ({
  getStory: vi.fn(),
  listEntities: vi.fn(),
}))

import { getStory, listEntities } from '../../api/storyApi'
import MatchDetailModal, {
  fmtDate,
  shortUuid,
  StatusBadge,
  fetchStoryCtx,
  STATUS_BADGE,
} from '../../components/match/MatchDetailModal'

describe('MatchDetailModal helpers', () => {
  it('fmtDate handles empty, invalid and valid ISO dates', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate('not-a-date')).toBe('not-a-date')
    expect(fmtDate('2024-01-02T03:04:05Z')).not.toBe('—')
  })

  it('shortUuid truncates and handles missing values', () => {
    expect(shortUuid(null)).toBe('—')
    expect(shortUuid('abcdefghxyz')).toBe('abcdefgh…')
  })

  it('StatusBadge maps known statuses and falls back', () => {
    const { container, rerender } = render(<StatusBadge status="RUNNING" />)
    expect(container.querySelector('span').className).toContain(STATUS_BADGE.RUNNING)
    rerender(<StatusBadge status={undefined} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('fetchStoryCtx', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null without a story uuid', async () => {
    expect(await fetchStoryCtx(null)).toBeNull()
  })

  it('aggregates the story context from the API', async () => {
    getStory.mockResolvedValue({ uuid: 's1', title: 'Quest' })
    listEntities.mockResolvedValue([])
    const ctx = await fetchStoryCtx('s1')
    expect(ctx.story.title).toBe('Quest')
    expect(getStory).toHaveBeenCalledWith('s1')
    expect(listEntities).toHaveBeenCalledWith('s1', 'texts')
  })

  it('returns null when the API rejects', async () => {
    getStory.mockRejectedValue(new Error('boom'))
    expect(await fetchStoryCtx('s1')).toBeNull()
  })
})

describe('MatchDetailModal render', () => {
  const baseTexts = [{ idText: 7, lang: 'en', shortText: 'Brave' }]

  function makeDetail(over = {}) {
    return {
      uuid: 'match-uuid-1234',
      loading: false,
      error: null,
      info: {
        match: {
          name: 'My Match',
          status: 'RUNNING',
          singlePlayer: 1,
          storyUuid: 'story-uuid-1',
          difficultyUuid: 'diff-1',
          characterTemplateUuid: 'char-1',
          classUuid: 'class-1',
          traitUuids: ['trait-1', 'trait-unknown'],
          currentClock: 3,
          expCost: 5,
          tsInsert: '2024-01-02T03:04:05Z',
        },
        currentLocationName: 'Cave',
        locations: [{ uuid: 'loc-1', idLocation: 1, flagAlreadyActived: true, clockCounter: 2 }],
        registry: [{ uuid: 'r1', key: 'gold', values: ['x', '10'], multiValue: true }],
      },
      storyCtx: {
        story: { title: 'Quest', author: 'Bob' },
        texts: baseTexts,
        difficulties: [{ uuid: 'diff-1', idTextName: 7 }],
        characters: [{ uuid: 'char-1', idTextName: 7 }],
        classes: [{ uuid: 'class-1', idTextName: 7 }],
        traits: [{ uuid: 'trait-1', idTextName: 7 }],
        storyLocations: [{ uuid: 'loc-1', idTextName: 7 }],
      },
      ...over,
    }
  }

  it('renders the full match detail with resolved entity names', () => {
    render(<MatchDetailModal detail={makeDetail()} onClose={vi.fn()} />)
    expect(screen.getByText('My Match')).toBeInTheDocument()
    expect(screen.getByText('Quest')).toBeInTheDocument()
    expect(screen.getByText('Single')).toBeInTheDocument()
    expect(screen.getAllByText('Brave').length).toBeGreaterThan(0)
    expect(screen.getByText('gold')).toBeInTheDocument()
  })

  it('shows the loading spinner while loading', () => {
    render(<MatchDetailModal detail={makeDetail({ loading: true, info: null })} onClose={vi.fn()} />)
    expect(screen.getByText(/Loading match info/)).toBeInTheDocument()
  })

  it('renders empty-state rows when there are no locations or registry', () => {
    const d = makeDetail()
    d.info.locations = []
    d.info.registry = []
    render(<MatchDetailModal detail={d} onClose={vi.fn()} />)
    expect(screen.getByText('No locations.')).toBeInTheDocument()
    expect(screen.getByText('No registry entries.')).toBeInTheDocument()
  })

  it('fires onClose from the backdrop and the close button', () => {
    const onClose = vi.fn()
    render(<MatchDetailModal detail={makeDetail()} onClose={onClose} />)
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('fires onClose when Escape key is pressed on backdrop', () => {
    const onClose = vi.fn()
    render(<MatchDetailModal detail={makeDetail()} onClose={onClose} />)
    const backdrop = document.querySelector('.pg-modal-backdrop')
    fireEvent.keyDown(backdrop, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not fire onClose when non-Escape key is pressed on backdrop', () => {
    const onClose = vi.fn()
    render(<MatchDetailModal detail={makeDetail()} onClose={onClose} />)
    const backdrop = document.querySelector('.pg-modal-backdrop')
    fireEvent.keyDown(backdrop, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

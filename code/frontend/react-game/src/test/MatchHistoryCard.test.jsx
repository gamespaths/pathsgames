import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))
const captured = []
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    captured.push(props)
    return <button onClick={props.onAction}>{props.card.title}</button>
  },
}))

import MatchHistoryCard from '../features/matches/MatchHistoryCard'

describe('MatchHistoryCard (v0.37.4)', () => {
  it('is a little history-badged card whose action opens the log', () => {
    const onOpen = vi.fn()
    render(<MatchHistoryCard story={{ title: 'S' }} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('matches.history'))
    expect(onOpen).toHaveBeenCalled()
    expect(captured[0]).toEqual(expect.objectContaining({
      entityType: 'matchlog', actionLabel: 'matches.historyOpen', actionIcon: 'fa-history',
      hidePreview: true, story: { title: 'S' },
    }))
    expect(captured[0].card.description).toBe('matches.historyDescription')
  })
})

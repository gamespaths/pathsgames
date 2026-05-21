import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

import MatchCard from '../features/matches/MatchCard'

const STORY = {
  uuid: 's1',
  title: 'Dragon Keep',
  card: { title: 'Dragon Keep', urlImage: null, awesomeIcon: 'fas fa-dragon' },
}

function wrap(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('MatchCard', () => {
  it('shows story title', () => {
    wrap(<MatchCard match={{ uuid: 'm1', status: 'RUNNING' }} story={STORY} onResume={vi.fn()} />)
    expect(screen.getByText('Dragon Keep')).toBeInTheDocument()
  })

  it('shows resume button for RUNNING status', () => {
    wrap(<MatchCard match={{ uuid: 'm1', status: 'RUNNING' }} story={STORY} onResume={vi.fn()} />)
    expect(screen.getByText('matches.resume')).toBeInTheDocument()
  })

  it('shows resume button for CREATED status', () => {
    wrap(<MatchCard match={{ uuid: 'm1', status: 'CREATED' }} story={STORY} onResume={vi.fn()} />)
    expect(screen.getByText('matches.resume')).toBeInTheDocument()
  })

  it('calls onResume when resume button clicked', () => {
    const onResume = vi.fn()
    wrap(<MatchCard match={{ uuid: 'm1', status: 'RUNNING' }} story={STORY} onResume={onResume} />)
    fireEvent.click(screen.getByText('matches.resume'))
    expect(onResume).toHaveBeenCalledOnce()
  })

  it('shows status overlay for PAUSED and no resume button', () => {
    wrap(<MatchCard match={{ uuid: 'm1', status: 'PAUSED' }} story={STORY} onResume={vi.fn()} />)
    expect(screen.getByText('matches.status.PAUSED')).toBeInTheDocument()
    expect(screen.queryByText('matches.resume')).toBeNull()
  })

  it('shows status overlay for ENDED', () => {
    wrap(<MatchCard match={{ uuid: 'm1', status: 'ENDED' }} story={STORY} onResume={vi.fn()} />)
    expect(screen.getByText('matches.status.ENDED')).toBeInTheDocument()
  })

  it('shows status overlay for GAMEOVER', () => {
    wrap(<MatchCard match={{ uuid: 'm1', status: 'GAMEOVER' }} story={STORY} onResume={vi.fn()} />)
    expect(screen.getByText('matches.status.GAMEOVER')).toBeInTheDocument()
  })

  it('shows info popover on (i) click and hides on close', () => {
    wrap(<MatchCard match={{ uuid: 'm1', status: 'RUNNING', tsInsert: '2026-01-01T10:00:00Z', currentClock: 5 }} story={STORY} onResume={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('card.info'))  // GameCard uses t('card.info')
    expect(screen.getByText(/matches\.statusLabel/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Close info'))
    expect(screen.queryByText(/matches\.statusLabel/)).toBeNull()
  })

  it('uses fallback name when story is null', () => {
    wrap(<MatchCard match={{ uuid: 'm1', status: 'RUNNING' }} story={null} onResume={vi.fn()} />)
    expect(screen.getByText('matches.unknownStory')).toBeInTheDocument()
  })
})

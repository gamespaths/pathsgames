import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// The history page carries no tip and no description, even in a tutorial story (real dictionaries).
vi.mock('../api/matches', () => ({ getMatchLogs: vi.fn(() => Promise.resolve({ logs: [], nextCursor: null })) }))

import { LanguageProvider } from '../i18n/context'
import MatchLogCard from '../features/matches/MatchLogCard'
import en from '../i18n/en.json'
import it_ from '../i18n/it.json'

describe('MatchLogCard without tip', () => {
  it('has no tips.matchlog text in EN or IT', () => {
    expect(en.tips.matchlog).toBeUndefined()
    expect(it_.tips.matchlog).toBeUndefined()
  })

  it('shows neither the tip link nor the description box, even in a tutorial story', async () => {
    const { container } = render(
      <LanguageProvider>
        <MatchLogCard matchUuid="m1" accessToken="x" story={{ title: 'S', author: 'A', category: 'tutorial' }}
          match={{ uuid: 'm1', status: 'ENDED', tsInsert: '2026-09-01T10:00:00Z' }} />
      </LanguageProvider>
    )
    await waitFor(() => screen.getByTestId('match-log-card'))
    expect(screen.queryByTestId('tip-note')).toBeNull()
    expect(container.querySelector('.book-page-desc')).toBeNull()
    expect(container.querySelector('.gc-credits')?.textContent ?? '').not.toMatch(/\btip\b/i)
  })
})

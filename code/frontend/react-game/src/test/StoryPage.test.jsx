import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('@/features/start-book/StartBook', () => ({
  default: ({ storyId, story, initialConfig }) => (
    <div data-testid="start-book">{storyId}|{story?.title ?? 'no-story'}|{initialConfig?.class?.name ?? 'no-config'}</div>
  ),
}))

import StoryPage from '../pages/StoryPage'

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/story/:storyId" element={<StoryPage />} /></Routes>
    </MemoryRouter>,
  )
}

describe('StoryPage (/story/:storyId, v1.13.0)', () => {
  it('from the Home: the story of the router state', () => {
    renderAt({ pathname: '/story/s1', state: { story: { title: 'Forest' } } })
    expect(screen.getByTestId('start-book')).toHaveTextContent('s1|Forest|no-config')
  })

  it('back from start-match: the story and the loadout to reopen with', () => {
    renderAt({ pathname: '/story/s1', state: { story: { title: 'Forest' }, config: { class: { name: 'Mage' } } } })
    expect(screen.getByTestId('start-book')).toHaveTextContent('s1|Forest|Mage')
  })

  it('a direct load (typed URL, new tab): only the id', () => {
    renderAt('/story/s7')
    expect(screen.getByTestId('start-book')).toHaveTextContent('s7|no-story|no-config')
  })
})

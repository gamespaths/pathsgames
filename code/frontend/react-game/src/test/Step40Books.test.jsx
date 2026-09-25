import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/context'
import { PolicyBookProvider, usePolicyBook } from '../context/PolicyBookContext'
import PolicyBook from '../components/modals/PolicyBook'
import Footer from '../components/layout/Footer'
import en from '../i18n/en.json'
import itDict from '../i18n/it.json'

// Step 40 — the roadmap book opened from the footer Devlog link.

vi.mock('@/consent/cookieConsent', () => ({ openCookiePreferences: vi.fn() }))
vi.mock('../context/ServerContext', () => ({
  useServer: () => ({ server: 's', servers: [{ label: 'L', url: 's' }], probing: false,
    status: 'online', version: '', changeServer: vi.fn() }),
}))

function Spy({ seen }) { const { policyBook } = usePolicyBook(); seen.push(policyBook); return null }

describe('roadmap book', () => {
  it('the footer Devlog opens it: intro on the left, six version cards on the right', () => {
    const seen = []
    const { container } = render(
      <LanguageProvider><PolicyBookProvider>
        <Footer /><PolicyBook /><Spy seen={seen} />
      </PolicyBookProvider></LanguageProvider>)
    fireEvent.click(screen.getByText(en.footer.devlog).closest('a'))
    expect(seen[seen.length - 1]).toBe('roadmap')
    const left = container.querySelector('.book-page-left')
    expect(left.querySelector('.book-page-title').textContent).toContain('paths.games')
    const intro = left.querySelector('.book-page-desc')
    expect(intro.textContent).toContain('open-source project')
    expect(intro.textContent).toContain('GNU GPL v3')
    expect(intro.textContent).toContain('CC BY-NC-ND 4.0')
    // Its two blank lines read half a line high.
    expect(intro.querySelectorAll('.book-page-gap')).toHaveLength(2)
    expect(container.querySelectorAll('.book-page-right .roadmap-cards .pg-card').length).toBe(6)
    expect(container.querySelectorAll('.book-page-right [data-testid="roadmap-current"]').length).toBe(1)
  })

  it('EN and IT carry every Step 40 key', () => {
    for (const d of [en, itDict]) {
      expect(d.modals.roadmap.intro).toBeTruthy()
      expect(d.modals.roadmap.current).toBeTruthy()
      expect(d.envBadge.dev).toBeTruthy()
      expect(d.matchLog.types.CHOICE).toBeTruthy()
      expect(d.card.tip && d.card.hideTip).toBeTruthy()
      expect(Object.keys(d.tips).length).toBeGreaterThan(10)
      expect(Object.keys(d.tips)).toEqual(Object.keys(en.tips))
    }
    expect(Object.keys(itDict.envBadge)).toEqual(Object.keys(en.envBadge))
    // The mission step is a type of its own: its footer label and its tip, in both languages.
    for (const d of [en, itDict]) {
      expect(d.book.missionStep && d.book.missions && d.tips.missionStep).toBeTruthy()
      expect(d.tips.missionStep).not.toBe(d.tips.missions)
    }
  })
})

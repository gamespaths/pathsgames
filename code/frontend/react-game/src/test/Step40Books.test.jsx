import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LanguageProvider } from '../i18n/context'
import { PolicyBookProvider, usePolicyBook } from '../context/PolicyBookContext'
import PolicyBook, { REPO_URL } from '../components/modals/PolicyBook'
import Footer from '../components/layout/Footer'
import roadmap from '../data/roadmap.json'
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
    fireEvent.click(screen.getByText(en.footer.devlog).closest('button'))
    expect(seen[seen.length - 1]).toBe('roadmap')
    const left = container.querySelector('.book-page-left')
    expect(left.querySelector('.book-page-title').textContent).toContain('paths.games')
    const intro = left.querySelector('.book-page-desc')
    expect(intro.textContent).toContain('open-source project')
    expect(intro.textContent).toContain('GNU GPL v3')
    // The intro links the repository (with the GitHub glyph) and the credits page, one text.
    const repo = intro.querySelector(`a[href="${REPO_URL}"]`)
    expect(repo.textContent).toContain(en.modals.roadmap.introRepo)
    expect(repo.querySelector('i.fa-github')).toBeTruthy()
    // Each <br /> pair of the text becomes two real line breaks: no leftover markup.
    const pairs = en.modals.roadmap.intro.split('<br /><br />').length - 1
    expect(intro.querySelectorAll('br')).toHaveLength(pairs * 2)
    // Step 42 — the team stories' licence links the CC BY-NC-ND 4.0 deed.
    const licence = intro.querySelector('a[href="https://creativecommons.org/licenses/by-nc-nd/4.0/"]')
    expect(licence.textContent).toBe('CC BY-NC-ND 4.0')
    expect(licence.getAttribute('target')).toBe('_blank')
    expect(intro.textContent).not.toContain('{license}')
    expect(intro.textContent).not.toContain('<br')
    expect(container.querySelectorAll('.book-page-right .roadmap-cards .pg-card').length).toBe(6)
    expect(container.querySelectorAll('.book-page-right [data-testid="roadmap-current"]').length).toBe(1)
    // Step 42 — each completed version carries the green "completed" badge.
    const done = container.querySelectorAll('.book-page-right [data-testid="roadmap-completed"]')
    expect(done.length).toBe(roadmap.filter(e => e.status === 'completed').length)
    expect(done[0].querySelector('i.fa-check-circle.story-card-status__check')).toBeTruthy()
    expect(done[0].textContent).toBe(en.modals.roadmap.completed)
    // The credits link swaps this book for the credits one, from inside the intro.
    fireEvent.click(within(left).getByRole('button', { name: en.modals.roadmap.introCredits }))
    expect(seen[seen.length - 1]).toBe('credits')
    expect(container.querySelector('.book-page-right .credits-cards')).toBeTruthy()
  })

  it('EN and IT carry every Step 40 key', () => {
    for (const d of [en, itDict]) {
      expect(d.modals.roadmap.intro).toBeTruthy()
      expect(d.modals.roadmap.introRepo).toBeTruthy()
      expect(d.modals.roadmap.introCredits).toBeTruthy()
      // The intro carries the two placeholders the links fill.
      expect(d.modals.roadmap.intro).toContain('{repo}')
      expect(d.modals.roadmap.intro).toContain('{credits}')
      expect(d.modals.roadmap.intro).toContain('{license}')
      expect(d.modals.roadmap.intro.split('<br /><br />').length).toBeGreaterThanOrEqual(3)
      expect(d.modals.roadmap.current).toBeTruthy()
      expect(d.modals.roadmap.completed).toBeTruthy()
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

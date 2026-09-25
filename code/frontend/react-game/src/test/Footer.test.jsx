import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Footer from '../components/layout/Footer'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({
    t: (key) => key,
    lang: 'en',
    setLang: vi.fn(),
  }),
}))

vi.mock('../context/ServerContext', () => ({
  useServer: () => ({
    server: 'http://localhost:8042',
    servers: [{ label: 'Local', url: 'http://localhost:8042' }],
    probing: false,
    status: 'online',
    version: '',
    changeServer: vi.fn(),
  }),
}))

describe('Footer', () => {
  it('renders Paths Games brand', () => {
    render(<Footer />)
    const matches = screen.getAllByText(/Paths Games/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders GitHub link', () => {
    render(<Footer />)
    const links = screen.getAllByRole('link')
    const github = links.find((l) => l.href.includes('github.com'))
    expect(github).toBeDefined()
  })

  it('renders Instagram link', () => {
    render(<Footer />)
    const links = screen.getAllByRole('link')
    const ig = links.find((l) => l.href.includes('instagram'))
    expect(ig).toBeDefined()
  })

  it('renders YouTube link', () => {
    render(<Footer />)
    const links = screen.getAllByRole('link')
    const yt = links.find((l) => l.href.includes('youtube'))
    expect(yt).toBeDefined()
  })

  it('shows the only server as a fixed name, with no drop-down', () => {
    const { container } = render(<Footer />)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(container.querySelector('.footer-server-row .footer-server-name').textContent).toBe('Local')
    // The row opens with its own label and draws the status dot as a sized-with-text class.
    expect(container.querySelector('.footer-server-row .footer-server-label').textContent).toBe('footer.serverSelect: ')
    expect(container.querySelector('.footer-server-row .footer-server-dot')).toBeTruthy()
  })

  it('marks Instagram and YouTube as social links (hidden on mobile by mobile.css), not GitHub', () => {
    render(<Footer />)
    const links = screen.getAllByRole('link')
    const byHost = host => links.find((l) => l.href.includes(host))
    for (const host of ['instagram', 'youtube']) {
      expect(byHost(host).classList.contains('footer-social-link')).toBe(true)
    }
    expect(byHost('github.com').classList.contains('footer-social-link')).toBe(false)
  })
})

describe('Footer policy links', () => {
  it('open the policy book instead of a Bootstrap modal', async () => {
    const { PolicyBookProvider, usePolicyBook } = await import('../context/PolicyBookContext')
    const seen = []
    function Spy() { const { policyBook } = usePolicyBook(); seen.push(policyBook); return null }
    render(<PolicyBookProvider><Footer /><Spy /></PolicyBookProvider>)
    for (const [label, kind] of [['footer.privacy', 'privacy'], ['footer.terms', 'terms'], ['footer.cookies', 'cookies'], ['footer.credits', 'credits']]) {
      fireEvent.click(screen.getByText(label).closest('a'))
      expect(seen.at(-1)).toBe(kind)
    }
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Footer from '../components/layout/Footer'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({
    t: (key) => (key === 'footer.serverVersion' ? 'server {version}' : key),
    lang: 'en',
    setLang: vi.fn(),
  }),
}))

const srv = vi.hoisted(() => ({ value: null }))
vi.mock('../context/ServerContext', () => ({ useServer: () => srv.value }))

const ONE = { server: 'http://localhost:8042', servers: [{ label: 'Local', url: 'http://localhost:8042' }],
  probing: false, status: 'online', version: '1.13.0', changeServer: vi.fn() }

describe('Footer (v1.13.0 — two centred rows)', () => {
  beforeEach(() => { srv.value = { ...ONE } })

  it('row 1: env badge, server, then "PATHS GAMES v<client> © ALL RIGHTS RESERVED"', () => {
    const { container } = render(<Footer />)
    const rows = container.querySelectorAll('.footer-inner > .footer-row')
    expect(rows.length).toBe(2)
    expect(rows[0]).toHaveClass('footer-row--status')
    const copy = screen.getByTestId('footer-copy')
    expect(rows[0].contains(copy)).toBe(true)
    expect(copy.textContent).toMatch(/PATHS GAMES\s+v\d+\.\d+\.\d+\s+©\s+FOOTER\.RIGHTS/)
    expect(copy.querySelector('.fa-dice-d20')).toBeInTheDocument()
  })

  it('row 2: the four policy links, full and short labels', () => {
    const { container } = render(<Footer />)
    const links = container.querySelectorAll('.footer-row--links button')
    expect(links.length).toBe(4)
    for (const kind of ['privacy', 'terms', 'cookies', 'credits']) {
      expect(screen.getByText(`footer.${kind}`)).toHaveClass('footer-link__full')
      expect(screen.getByText(`footer.short.${kind}`)).toHaveClass('footer-link__short')
    }
  })

  it('leaves out GitHub, Instagram, YouTube, the alpha sentence and the crafted-by line', () => {
    const { container } = render(<Footer />)
    expect(screen.queryAllByRole('link')).toEqual([])
    for (const gone of ['footer.alphaPrefix', 'footer.madeWith', 'FOOTER.MADEWITH', 'footer.github', 'footer.instagram']) {
      expect(container.textContent).not.toContain(gone)
    }
  })

  it('one server online: a badge "green icon, server <version>", short version on mobile', () => {
    const { container } = render(<Footer />)
    expect(screen.queryByRole('combobox')).toBeNull()
    const badge = container.querySelector('.footer-server-badge--online')
    expect(badge.querySelector('.footer-server-icon')).toBeInTheDocument()
    expect(badge.querySelector('.footer-server__full').textContent).toBe('server 1.13.0')
    expect(badge.querySelector('.footer-server__short').textContent).toBe('1.13.0')
    // its drawn tooltip is the servers warning
    expect(badge).toHaveAttribute('data-tip', 'footer.serversWarning')
  })

  it('one server online without a version: just "server"', () => {
    srv.value = { ...ONE, version: '' }
    const { container } = render(<Footer />)
    expect(container.querySelector('.footer-server__full').textContent).toBe('server')
  })

  it('one server offline: a red icon with footer.serverOffline', () => {
    srv.value = { ...ONE, status: 'offline' }
    const { container } = render(<Footer />)
    const badge = container.querySelector('.footer-server-badge--offline')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toContain('footer.serverOffline')
    expect(badge).toHaveAttribute('data-tip', 'footer.serversWarning')
  })

  it('probing, or one server still loading: footer.serverDetecting (no hard-coded English)', () => {
    srv.value = { ...ONE, probing: true }
    const { unmount } = render(<Footer />)
    expect(screen.getByText('footer.serverDetecting')).toHaveAttribute('data-tip', 'footer.serversWarning')
    expect(screen.queryByText('detecting…')).toBeNull()
    unmount()
    srv.value = { ...ONE, status: 'loading' }
    render(<Footer />)
    expect(screen.getByText('footer.serverDetecting')).toBeInTheDocument()
  })

  it('works with an empty server list', () => {
    srv.value = { ...ONE, servers: [], version: null }
    const { container } = render(<Footer />)
    expect(container.querySelector('.footer-server-badge--online')).toBeInTheDocument()
  })
})

describe('Footer policy links', () => {
  it('open the policy chapter', async () => {
    srv.value = { ...ONE }
    const { PolicyBookProvider, usePolicyBook } = await import('../context/PolicyBookContext')
    const seen = []
    function Spy() { const { policyBook } = usePolicyBook(); seen.push(policyBook); return null }
    render(<PolicyBookProvider><Footer /><Spy /></PolicyBookProvider>)
    for (const [label, kind] of [['footer.privacy', 'privacy'], ['footer.terms', 'terms'], ['footer.cookies', 'cookies'], ['footer.credits', 'credits']]) {
      fireEvent.click(screen.getByText(label).closest('button'))
      expect(seen.at(-1)).toBe(kind)
    }
  })
})

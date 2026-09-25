import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Step 40 — the footer names the build's version through the env badge, then the servers warning.
const env = vi.hoisted(() => ({ code: 'alpha' }))
vi.mock('../constants/features', async (orig) => ({
  ...(await orig()),
  get ENV_BADGE() { return env.code },
}))
vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (key) => (key === 'envBadge.alpha' ? 'Alpha version' : key), lang: 'en' }),
}))
vi.mock('../context/ServerContext', () => ({
  useServer: () => ({ server: 's', servers: [{ label: 'S', url: 's' }], probing: false,
    status: 'online', version: '', changeServer: vi.fn() }),
}))

import Footer from '../components/layout/Footer'
import { envBadgeLabel } from '../components/layout/EnvBadge'

describe('Footer env badge (Step 40)', () => {
  beforeEach(() => { env.code = 'alpha' })

  it('reads "prefix + badge", then the crafted-by line on the next one', () => {
    const { container } = render(<Footer />)
    const warning = container.querySelector('.footer-alpha-warning')
    const badge = screen.getByTestId('env-badge')
    expect(warning.contains(badge)).toBe(true)
    expect(badge.textContent).toBe('Alpha version')
    expect(warning.textContent).toMatch(/footer\.alphaPrefix\s*Alpha version\s*v0\.40\.0/)
    expect(badge.nextSibling.tagName).toBe('BR')
  })

  it('drops the sentence and the badge when the build has none (prod), keeps the warning', () => {
    env.code = 'prod'
    const { container } = render(<Footer />)
    expect(screen.queryByTestId('env-badge')).toBeNull()
    expect(container.textContent).not.toContain('footer.alphaPrefix')
    expect(container.textContent).toContain('footer.serversWarning')
  })

  it('puts the crafted-by line between the badge line and the servers warning, above the rights', () => {
    const { container } = render(<Footer />)
    const warning = container.querySelector('.footer-alpha-warning').textContent
    expect(warning.indexOf('Alpha version')).toBeLessThan(warning.indexOf('FOOTER.MADEWITH'))
    expect(warning.indexOf('FOOTER.BYTEAM')).toBeLessThan(warning.indexOf('footer.serversWarning'))
    const text = container.textContent
    expect(text.indexOf('footer.serversWarning')).toBeLessThan(text.indexOf('FOOTER.RIGHTS'))
  })

  it('envBadgeLabel: translated label, upper-cased unknown code, null for empty or prod', () => {
    const t = (k) => (k === 'envBadge.dev' ? 'Local version' : k)
    expect(envBadgeLabel('dev', t)).toBe('Local version')
    expect(envBadgeLabel('gamma', t)).toBe('GAMMA')
    expect(envBadgeLabel('', t)).toBeNull()
    expect(envBadgeLabel(' PROD ', t)).toBeNull()
    expect(envBadgeLabel(undefined, t)).toBeNull()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Step 40 / v1.13.0 — the footer opens row 1 with the build's env badge, the Devlog's door.
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
const policy = vi.hoisted(() => ({ open: null }))
vi.mock('../context/PolicyBookContext', () => ({ usePolicyBook: () => ({ openPolicyBook: policy.open }) }))

import Footer from '../components/layout/Footer'
import EnvBadge, { envBadgeLabel, envBadgeShortLabel } from '../components/layout/EnvBadge'

describe('Footer env badge (v1.13.0)', () => {
  beforeEach(() => { env.code = 'alpha'; policy.open = vi.fn() })

  it('opens row 1 with the env label and its info icon, which open the Devlog', () => {
    const { container } = render(<Footer />)
    const badge = screen.getByTestId('env-badge')
    expect(container.querySelector('.footer-row--status').firstChild).toBe(badge)
    expect(badge.textContent).toBe('Alpha version')
    expect(badge.querySelector('.fa-info-circle')).toBeInTheDocument()
    expect(badge).toHaveAttribute('data-tip', 'Alpha version — footer.devlog')
    expect(badge).not.toHaveAttribute('title')
    fireEvent.click(badge)
    expect(policy.open).toHaveBeenCalledWith('roadmap')
  })

  it('no label (prod): the info icon alone, with the "Devlog" drawn tooltip', () => {
    env.code = 'prod'
    render(<Footer />)
    const icon = screen.getByTestId('env-badge')
    expect(icon).toHaveClass('env-badge--icon')
    expect(icon.textContent).toBe('')
    expect(icon).toHaveAttribute('aria-label', 'footer.devlog')
    expect(icon).toHaveAttribute('data-tip', 'footer.devlog')
    fireEvent.click(icon)
    expect(policy.open).toHaveBeenCalledWith('roadmap')
  })

  it('the navbar variant still shows nothing without a label', () => {
    const { container } = render(<EnvBadge code="" />)
    expect(container.firstChild).toBeNull()
  })

  it('envBadgeLabel: translated label, upper-cased unknown code, null for empty or prod', () => {
    const t = (k) => (k === 'envBadge.dev' ? 'Local version' : k)
    expect(envBadgeLabel('dev', t)).toBe('Local version')
    expect(envBadgeLabel('gamma', t)).toBe('GAMMA')
    expect(envBadgeLabel('', t)).toBeNull()
    expect(envBadgeLabel(' PROD ', t)).toBeNull()
    expect(envBadgeLabel(undefined, t)).toBeNull()
  })

  it('envBadgeShortLabel: the short key, else the full label', () => {
    const t = (k) => ({ 'envBadge.dev': 'Local version', 'envBadge.short.dev': 'Local', 'envBadge.test': 'Test version' })[k] ?? k
    expect(envBadgeShortLabel('dev', t)).toBe('Local')
    expect(envBadgeShortLabel('test', t)).toBe('Test version')
    expect(envBadgeShortLabel('prod', t)).toBeNull()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from '../components/layout/Footer'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({
    t: (key) => key,
    lang: 'en',
    setLang: vi.fn(),
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
})

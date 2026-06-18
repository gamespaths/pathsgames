import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/context'
import CookiesModal from '../components/modals/CookiesModal'
import PrivacyModal from '../components/modals/PrivacyModal'
import TermsModal from '../components/modals/TermsModal'
import CreditsModal from '../components/modals/CreditsModal'
import CardDetailModal from '../components/modals/CardDetailModal'

const wrap = (ui) => render(<LanguageProvider>{ui}</LanguageProvider>)

describe('policy & info modals', () => {
  it('CookiesModal renders its dialog and all six sections', () => {
    const { container } = wrap(<CookiesModal />)
    expect(container.querySelector('#cookiePolicyModal')).toBeTruthy()
    expect(container.querySelectorAll('h6').length).toBe(6)
  })

  it('PrivacyModal renders its dialog and eleven sections', () => {
    const { container } = wrap(<PrivacyModal />)
    expect(container.querySelector('#privacyPolicyModal')).toBeTruthy()
    expect(container.querySelectorAll('h6').length).toBe(11)
  })

  it('TermsModal renders its dialog and twelve sections', () => {
    const { container } = wrap(<TermsModal />)
    expect(container.querySelector('#termsModal')).toBeTruthy()
    expect(container.querySelectorAll('h6').length).toBe(12)
  })

  it('CreditsModal renders a card grid from images.json', () => {
    const { container } = wrap(<CreditsModal />)
    expect(container.querySelector('#creditsModal')).toBeTruthy()
    expect(container.querySelector('.credits-grid')).toBeTruthy()
  })
})

describe('CardDetailModal', () => {
  it('returns null when no card is provided', () => {
    const { container } = wrap(
      <CardDetailModal card={null} modalId="m0" actionLabel="Go" onAction={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the card image + name and fires onAction', () => {
    const onAction = vi.fn()
    wrap(
      <CardDetailModal
        card={{ name: 'Forest', description: 'Dark woods', urlImage: 'http://x/y.png', awesomeIcon: 'fas fa-tree' }}
        modalId="m1"
        actionLabel="Enter"
        onAction={onAction}
      />
    )
    expect(screen.getAllByText('Forest').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('Enter'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('renders the icon placeholder when the card has no image', () => {
    wrap(
      <CardDetailModal
        card={{ name: 'NoImage', description: 'plain' }}
        modalId="m2"
        actionLabel="Go"
        onAction={() => {}}
      />
    )
    expect(screen.getAllByText('NoImage').length).toBeGreaterThan(0)
  })
})

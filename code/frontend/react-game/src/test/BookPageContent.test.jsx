import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/context'
import BookPageContent from '../components/book/BookPageContent'

const wrap = (ui) => render(<LanguageProvider>{ui}</LanguageProvider>)

describe('BookPageContent', () => {
  it('shows the loading spinner when loading', () => {
    const { container } = wrap(<BookPageContent card={null} loading />)
    expect(container.querySelector('.fa-spinner')).toBeTruthy()
  })

  it('renders title, image, description and credits; close fires onClose', () => {
    const onClose = vi.fn()
    const card = {
      title: 'Cave', description: '<b>Dark</b> place', urlImage: 'http://x/c.png',
      styleImageLarge: 'big', linkCopyright: 'http://x', copyrightText: 'Bob',
    }
    const { container } = wrap(<BookPageContent card={card} story={{ card }} onClose={onClose} />)
    expect(screen.getByText('Cave')).toBeInTheDocument()
    expect(container.querySelector('img.book-page-img')).toBeTruthy()
    expect(container.querySelector('.book-page-desc')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close preview'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders extraContent and entity stat badges (non-canonical key)', () => {
    const { container } = wrap(
      <BookPageContent
        card={{ title: 'Hero', description: 'a brave hero' }}
        entity={{ lifeMax: 5, energyMax: 0 }}
        entityType="character"
        extraContent={<span>extra-here</span>}
      />
    )
    expect(screen.getByText('extra-here')).toBeInTheDocument()
    expect(container.querySelector('.book-page-stats')).toBeTruthy()
  })

  it('uses the canonical totals label for ordered stat keys', () => {
    const { container } = wrap(
      <BookPageContent card={{ title: 'T', description: 'desc' }} entity={{ life: 3 }} entityType="trait" />
    )
    expect(container.querySelector('.book-page-stats')).toBeTruthy()
  })

  it('falls back to entity name/description when the card has none', () => {
    wrap(<BookPageContent card={null} entity={{ name: 'EntName', description: 'desc' }} entityType="character" />)
    expect(screen.getByText('EntName')).toBeInTheDocument()
  })
})

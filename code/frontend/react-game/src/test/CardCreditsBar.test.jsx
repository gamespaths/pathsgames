import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import CardCreditsBar, { STORY_LICENSE } from '../components/layout/CardCreditsBar'
import Card from '../components/layout/Card'
import TipNote from '../components/ui/TipNote'
import { PolicyBookProvider, usePolicyBook } from '../context/PolicyBookContext'
import { LanguageProvider } from '../i18n/context'
import { policyKindFromHref } from '../utils/policyDeepLink'
import { creditNotes, creditText, imageLicense, normalizeCreditUrl } from '../utils/cardCredits'

beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })

describe('CardCreditsBar', () => {
  it('returns null when neither author nor image credit nor tip is provided', () => {
    expect(render(<CardCreditsBar card={{}} story={{}} />).container.firstChild).toBeNull()
    expect(render(<CardCreditsBar />).container.firstChild).toBeNull()
  })

  it('renders TYPE - tip - story credit - image credit, each with its icon, credits in the cut-able box', () => {
    const { container } = render(<CardCreditsBar card={{ copyrightText: 'Bob' }} story={{ author: 'Alice' }}
      typeBadgeLabel="Location" tip={{ label: 'tip', onOpen: () => {} }} />)
    expect(container.querySelector('.gc-credits').textContent).toBe('Locationtipstory creditimage credit')
    expect(container.querySelector('.gc-credits__sep')).toBeNull()
    expect(screen.getByTestId('credit-tip').querySelector('.fa-lightbulb')).toBeTruthy()
    expect(screen.getByTestId('credit-story').querySelector('.fa-book')).toBeTruthy()
    expect(screen.getByTestId('credit-image').querySelector('.fa-image')).toBeTruthy()
    const text = container.querySelector('.gc-credits__text')
    expect(text.querySelector('.credit-author')).toBeTruthy()
    expect(text.querySelector('.credit-image')).toBeTruthy()
    expect(text.querySelector('.gc-credits__tip[data-testid="credit-tip"]')).toBeNull()
    expect(container.querySelector('[title]')).toBeNull()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('each entry keeps its full label at every width (no short form)', () => {
    render(<CardCreditsBar card={{}} story={{ author: 'Alice' }} />)
    const story = screen.getByTestId('credit-story')
    expect(story.textContent).toBe('story credit')
    expect(story.querySelector('.gc-credits__short')).toBeNull()
  })

  it('a click opens the credit through onOpenCredit and never reaches the card behind it', () => {
    const onOpenCredit = vi.fn()
    const onCard = vi.fn()
    render(<div onClick={onCard}><CardCreditsBar card={{ copyrightText: 'Bob' }} story={{ author: 'A' }}
      onOpenCredit={onOpenCredit} /></div>)
    fireEvent.click(screen.getByTestId('credit-story'))
    fireEvent.click(screen.getByTestId('credit-image'))
    expect(onOpenCredit.mock.calls).toEqual([['story'], ['image']])
    expect(onCard).not.toHaveBeenCalled()
  })

  it('the default onOpenCredit does nothing', () => {
    render(<CardCreditsBar card={{ copyrightText: 'Bob' }} story={{}} />)
    expect(() => fireEvent.click(screen.getByTestId('credit-image'))).not.toThrow()
  })

  it('uses the translated labels inside the language provider', () => {
    localStorage.setItem('pathsgames.lang', 'it')
    render(<LanguageProvider><CardCreditsBar card={{ copyrightText: 'Bob' }} story={{ author: 'Alice' }} /></LanguageProvider>)
    expect(screen.getByTestId('credit-story').textContent).toBe('crediti storia')
    expect(screen.getByTestId('credit-image').textContent).toBe('crediti immagine')
    localStorage.removeItem('pathsgames.lang')
  })
})

describe('credits in the card tip area', () => {
  const renderCard = ui => render(<LanguageProvider>{ui}</LanguageProvider>)
  const LOC = { uuid: 'l1', title: 'Square', description: 'A quiet square.',
    copyrightText: 'Bob', linkCopyright: 'https://unsplash.com/photos/x' }

  it('the story credit replaces the tip: book icon, text with licence, link icon to the story url', () => {
    renderCard(<Card variant="page" card={LOC} story={{ author: 'Alice', linkCopyright: 'story.example' }} />)
    expect(screen.queryByTestId('tip-note')).toBeNull()
    fireEvent.click(screen.getByTestId('credit-story'))
    const note = screen.getByTestId('tip-note')
    expect(note.textContent).toContain(`Story by Alice with ${STORY_LICENSE} license`)
    expect(note.querySelector('.fa-book')).toBeTruthy()
    const link = note.querySelector('.pg-tip__link')
    expect(link).toHaveAttribute('href', 'https://story.example')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.querySelector('.fa-external-link-alt')).toBeTruthy()
    // one line: ellipsis on the text, the link icon outside it so it is never cut
    expect(note.classList.contains('pg-tip--single')).toBe(true)
    expect(note.querySelector('.pg-tip__text').contains(link)).toBe(false)
  })

  it('the image credit swaps the note to the picture icon and the Unsplash licence', () => {
    renderCard(<Card variant="page" card={LOC} story={{ author: 'Alice' }} />)
    fireEvent.click(screen.getByTestId('credit-story'))
    fireEvent.click(screen.getByTestId('credit-image'))
    const note = screen.getByTestId('tip-note')
    expect(note.textContent).toContain('Image by Bob with Unsplash license')
    expect(note.querySelector('.fa-image')).toBeTruthy()
    expect(note.querySelector('.fa-book')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'hide tip' }))
    expect(screen.queryByTestId('tip-note')).toBeNull()
  })

  it('a story page card shows the STORY type and opens the story tip', () => {
    renderCard(<Card variant="page" card={{ uuid: 's1', title: 'Infinite paths' }} entityType="story"
      story={{ author: 'Alice', category: 'Adventure' }} />)
    expect(document.querySelector('.gc-type-badge-credits').textContent).toBe('Story')
    fireEvent.click(screen.getByTestId('credit-tip'))
    expect(screen.getByTestId('tip-note').textContent).toContain('The story you are playing')
  })

  it('no url, no link icon', () => {
    renderCard(<Card variant="page" card={{ uuid: 'l2', title: 'X' }} story={{ author: 'Alice' }} />)
    fireEvent.click(screen.getByTestId('credit-story'))
    expect(screen.getByTestId('tip-note').querySelector('.pg-tip__link')).toBeNull()
  })

  it('a paths.games ?policy= link icon opens the policy book in place', () => {
    let probe
    const Probe = () => { probe = usePolicyBook(); return null }
    renderCard(<PolicyBookProvider><Probe />
      <Card variant="page" card={{ uuid: 'l3', title: 'X' }}
        story={{ author: 'paths.games', linkCopyright: 'https://paths.games/?policy=terms' }} />
    </PolicyBookProvider>)
    fireEvent.click(screen.getByTestId('credit-story'))
    const link = screen.getByTestId('tip-note').querySelector('.pg-tip__link')
    expect(link).not.toHaveAttribute('target')
    fireEvent.click(link)
    expect(probe.policyBook).toBe('terms')
  })
})

describe('TipNote', () => {
  it('defaults to the lightbulb and no link', () => {
    render(<TipNote text="Hello" hideLabel="hide" onHide={() => {}} />)
    const note = screen.getByTestId('tip-note')
    expect(note.classList.contains('pg-tip--single')).toBe(false)
    expect(note.querySelector('.fa-lightbulb')).toBeTruthy()
    expect(note.querySelector('.pg-tip__link')).toBeNull()
  })

  it('an external link click does not bubble to the card', () => {
    const onCard = vi.fn()
    render(<div onClick={onCard}><TipNote text="Hi" hideLabel="h" onHide={() => {}} icon="fa-image"
      link={{ href: 'https://a.example', label: 'open link' }} /></div>)
    const link = screen.getByRole('link', { name: 'open link' })
    fireEvent.click(link)
    expect(onCard).not.toHaveBeenCalled()
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

describe('credit helpers', () => {
  it('normalizeCreditUrl adds https to a bare host and keeps real links', () => {
    expect(normalizeCreditUrl('paths.games')).toBe('https://paths.games')
    expect(normalizeCreditUrl('https://a.example/x')).toBe('https://a.example/x')
    expect(normalizeCreditUrl('/?policy=terms')).toBe('/?policy=terms')
    expect(normalizeCreditUrl('  ')).toBeNull()
    expect(normalizeCreditUrl(null)).toBeNull()
  })

  it('imageLicense: explicit, Unsplash by link, else none', () => {
    expect(imageLicense({ license: 'CC0' })).toBe('CC0')
    expect(imageLicense({ linkCopyright: 'https://images.unsplash.com/a' })).toBe('Unsplash')
    expect(imageLicense({ linkCopyright: 'https://notunsplash.com.evil/a' })).toBeNull()
    expect(imageLicense({ linkCopyright: 'https://example.com' })).toBeNull()
    expect(imageLicense(null)).toBeNull()
  })

  it('creditNotes: story link preferred over the story card one, explicit licence, nulls when absent', () => {
    const notes = creditNotes({ copyrightText: 'Bob' },
      { author: 'Alice', license: 'CC BY 4.0', linkCopyright: 'https://s.example', card: { linkCopyright: 'https://c.example' } })
    expect(notes.story).toEqual({ text: 'Story by Alice with CC BY 4.0 license', url: 'https://s.example', policy: null })
    expect(notes.image).toEqual({ text: 'Image by Bob', url: null, policy: null })
    expect(creditNotes({}, { author: 'A', card: { linkCopyright: 'https://c.example' } }).story.url).toBe('https://c.example')
    expect(creditNotes(null, null)).toEqual({ story: null, image: null })
  })

  it('creditText: translation when present, English fallback, then the key', () => {
    expect(creditText(k => (k === 'card.storyBy' ? 'Storia di {name}' : k), 'card.storyBy', { name: 'A' })).toBe('Storia di A')
    expect(creditText(null, 'card.imageBy', { name: 'B' })).toBe('Image by B')
    expect(creditText(k => k, 'card.unknown')).toBe('card.unknown')
  })

  it('policyKindFromHref recognises the site policy links only', () => {
    const origin = 'https://paths.games'
    expect(policyKindFromHref('https://paths.games/?policy=terms', origin)).toBe('terms')
    expect(policyKindFromHref('https://www.paths.games/?policy=privacy', 'http://localhost:5173')).toBe('privacy')
    expect(policyKindFromHref('/?policy=cookies', 'http://localhost:5173')).toBe('cookies')
    expect(policyKindFromHref('https://evil.example/?policy=terms', origin)).toBeNull()
    expect(policyKindFromHref('https://paths.games/?policy=credits', origin)).toBeNull()
    expect(policyKindFromHref('https://paths.games/?policy=roadmap', origin)).toBe('roadmap')
    expect(policyKindFromHref('https://paths.games/', origin)).toBeNull()
    expect(policyKindFromHref(null, origin)).toBeNull()
    expect(policyKindFromHref('http://[bad', origin)).toBeNull()
    expect(policyKindFromHref('/?policy=terms', '')).toBe('terms')
  })
})

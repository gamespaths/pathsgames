import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  // Only the keys the card really has a line for answer; the rest echo, as the real t does.
  useTranslation: () => ({ t: (k) => (k === 'game.stats.descriptions.life' ? 'life gloss' : k) }),
}))

let captured = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    captured = props
    return <div data-testid="card">{props.card?.description}</div>
  },
}))

import InformationCard from '../features/gameplay/cards/InformationCard'

const STORY = {
  title: 'The Long Road', author: 'A. Nao',
  card: { urlImage: 'http://x/story.png', copyrightText: 'Someone', linkCopyright: 'http://x/credits' },
}
const PLAYER = { life: 3, lifeMax: 10, energy: 2, coins: 7 }
const CLOCK = { currentClock: 42, clockLabelSingular: 'Hour' }

describe('InformationCard', () => {
  it('takes the title from the story and drops the weather artwork', () => {
    render(<InformationCard variant="page" story={STORY} playerStats={PLAYER} clock={CLOCK}
      card={{ title: 'Rainy day', urlImage: 'http://x/rain.png', alternativeImage: 'http://x/alt.png' }} />)

    expect(captured.card.title).toBe('The Long Road')
    // Both image fields must be null: Card falls back to alternativeImage when urlImage is.
    expect(captured.card.urlImage).toBeNull()
    expect(captured.card.alternativeImage).toBeNull()
    expect(captured.variant).toBe('page')
    expect(captured.entityType).toBe('information')
  })

  it('keeps the rest of the incoming card (style) and its own props', () => {
    const onClose = vi.fn()
    render(<InformationCard story={STORY} playerStats={PLAYER} clock={CLOCK}
      card={{ linkCopyright: 'http://x', styleImageLarge: 'big' }} onClose={onClose} loading={false} />)

    expect(captured.card.styleImageLarge).toBe('big')
    expect(captured.card.descriptionTag).toBe(true)
    expect(captured.onClose).toBe(onClose)
  })

  it('writes one row per badge, each with its own translated gloss', () => {
    const { container } = render(<InformationCard story={STORY} playerStats={PLAYER} clock={CLOCK}
      card={{}} />)

    const rows = container.querySelectorAll('.information-card-row')
    // clock + 4 gauges + 7 plain stats — the full plainFlag badge list.
    expect(rows.length).toBe(12)
    expect(screen.getByText('life gloss')).toBeInTheDocument()
    // The clock badge is there, labelled by the story's own word for a time unit.
    expect(screen.getByText('Hour:')).toBeInTheDocument()
    expect(screen.getByText('3/10')).toBeInTheDocument()
    // A stat with no translated line gets no text, not the raw key.
    const glosses = [...container.querySelectorAll('.information-card-row-desc')].map(n => n.textContent)
    expect(glosses).toContain('')
    expect(glosses.every(g => !g.startsWith('game.stats.descriptions.'))).toBe(true)
  })

  it('showImage brings back the STORY artwork and its "image by" credits', () => {
    render(<InformationCard story={STORY} playerStats={PLAYER} showImage
      card={{ urlImage: 'http://x/rain.png', copyrightText: 'Rain author', linkCopyright: 'http://x/rain' }} />)

    // The story's picture, not the weather one the card was built from.
    expect(captured.card.urlImage).toBe('http://x/story.png')
    expect(captured.card.copyrightText).toBe('Someone')
    expect(captured.card.linkCopyright).toBe('http://x/credits')
  })

  it('hides the "image by" link along with the image, keeping the footer itself', () => {
    render(<InformationCard story={STORY} playerStats={PLAYER}
      card={{ copyrightText: 'Rain author', linkCopyright: 'http://x/rain' }} />)

    // Only the image half goes: CardCreditsBar still has the story author, so the footer
    // stays and reads "story by …" alone.
    expect(captured.card.copyrightText).toBeNull()
    expect(captured.card.linkCopyright).toBeNull()
    expect(captured.story.author).toBe('A. Nao')
  })

  it('survives a story with no card at all when showImage is on', () => {
    render(<InformationCard story={{ title: 'Bare' }} playerStats={PLAYER} showImage card={{}} />)

    expect(captured.card.title).toBe('Bare')
    expect(captured.card.urlImage).toBeNull()
  })

  it('closes the list with the clock: the turns row is the last one', () => {
    const { container } = render(<InformationCard story={STORY} playerStats={PLAYER} clock={CLOCK} card={{}} />)

    const rows = [...container.querySelectorAll('.information-card-row')]
    expect(rows[0].textContent).toContain('game.stats.life')
    expect(rows[rows.length - 1].textContent).toContain('Hour')
  })

  it('shows the zero stats too — a stat that ran out is the news', () => {
    const { container } = render(<InformationCard story={STORY} playerStats={{ life: 0 }} card={{}} />)

    const rows = container.querySelectorAll('.information-card-row')
    expect(rows.length).toBe(11) // no clock: none was passed
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('leaves every other preview type to the plain Card', () => {
    const card = { title: 'Mage', urlImage: 'http://x/mage.png' }
    render(<InformationCard variant="page" story={STORY} entityType="class" card={card} playerStats={PLAYER} />)

    expect(captured.card).toBe(card)
    expect(captured.card.urlImage).toBe('http://x/mage.png')
    expect(captured.entityType).toBe('class')
  })
})

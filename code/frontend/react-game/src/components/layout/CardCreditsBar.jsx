import { useTranslation } from '@/i18n/context'
import { CREDIT_ICONS, creditNotes, creditText } from '@/utils/cardCredits'

/**
 * CardCreditsBar — slim footer row, same style as gc-title: TYPE, tip, story credit, image credit.
 * Each entry opens its note in the card's tip area (`onOpen(kind)`); null when nothing to show.
 * No separators: the entries are spaced by CSS (wider on large screens).
 */
export { STORY_LICENSE } from '@/utils/cardCredits'

export default function CardCreditsBar({ card, story, typeBadgeLabel = null, tip = null, onOpenCredit = () => {} }) {
  const t = useTranslation()?.t
  const notes = creditNotes(card, story, t)
  if (!notes.story && !notes.image && !tip) return null

  const entry = (kind, className, onOpen, label) => (
    <button key={kind} type="button" className={`gc-credits__tip ${className}`} data-testid={`credit-${kind}`}
      onClick={e => { e.stopPropagation(); onOpen() }}>
      <i className={`fas ${CREDIT_ICONS[kind]} me-1`} aria-hidden="true" />{label}
    </button>
  )

  const credits = []
  if (notes.story) credits.push(entry('story', 'credit-author', () => onOpenCredit('story'), creditText(t, 'card.storyCredit')))
  if (notes.image) credits.push(entry('image', 'credit-image', () => onOpenCredit('image'), creditText(t, 'card.imageCredit')))

  const items = []
  if (typeBadgeLabel) items.push(<span key="type" className="gc-type-badge-credits">{typeBadgeLabel}</span>)
  if (tip) items.push(entry('tip', '', tip.onOpen, tip.label))
  if (credits.length > 0) {
    items.push(
      <span key="credits" className="gc-credits__text">
        {credits}
      </span>
    )
  }

  return (
    <div className="gc-credits">
      {items}
    </div>
  )
}

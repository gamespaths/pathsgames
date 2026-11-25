import CardBack from '@/components/layout/CardBack'
import { useAnimationSettings } from '@/context/AnimationContext'

/* Deck — step 14: the cards are dealt from it. `table`: ten backs on the table beside the book (desktop),
   `under` or `over` its cover; `page`: three backs at the end of the right page (step 16's sticky deck). */
const PILE_SIZE = 10
const PAGE_SIZE = 3

export default function Deck({ variant = 'table' }) {
  const { deck: place } = useAnimationSettings()
  if (variant === 'page') {
    return (
      <div className="deck" aria-hidden="true">
        {Array.from({ length: PAGE_SIZE - 1 }, (_, i) => <CardBack key={i} className="deck__card" pulse={false} />)}
        <CardBack className="deck__card deck__top" />
      </div>
    )
  }
  return (
    <div className="deck-pile" data-place={place} aria-hidden="true">
      {Array.from({ length: PILE_SIZE - 1 }, (_, i) => <CardBack key={i} className="deck-pile__card" pulse={false} />)}
      <CardBack className="deck-pile__card deck-pile__top" />
    </div>
  )
}

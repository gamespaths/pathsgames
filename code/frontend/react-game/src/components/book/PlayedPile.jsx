import { useTranslation } from '@/i18n/context'

/* PlayedPile — v1.15.0: the face-up pile on the table under the deck (desktop and tablet, in a match): the story's
   card at the bottom, the last five played cards on it, the last one straight and lit. Pictures only. */
export const PLAYED_SHOWN = 5

export default function PlayedPile({ story = null, played = [] }) {
  const i18n = useTranslation()
  const t = i18n?.t ?? (key => key)
  const list = played ?? []
  const shown = list.slice(-PLAYED_SHOWN)
  const first = list.length - shown.length
  const last = shown.at(-1)
  const tip = last ? t('game.playedPile.last').replace('{title}', last.title ?? '') : (story?.title || null)
  return (
    <div className="played-pile" data-tip={tip ?? undefined} role="img" aria-label={tip ?? undefined}>
      <PileCard card={story} className="played-card--story" />
      {shown.map((card, i) => (
        <PileCard key={first + i} card={card} className={i === shown.length - 1 ? 'played-card--top' : ''} />
      ))}
    </div>
  )
}

/** One card of the pile: its picture and its title in a small bar; no other text, badges or buttons. */
function PileCard({ card, className }) {
  return (
    <div className={['played-card', className].filter(Boolean).join(' ')} aria-hidden="true">
      {card?.image && <img className="played-card__img" src={card.image} alt="" draggable="false" />}
      {card?.title && <span className="played-card__title">{card.title}</span>}
    </div>
  )
}

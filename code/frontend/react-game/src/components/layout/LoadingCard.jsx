import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { buildLoadingCard } from '@/utils/loadoutCards'

/**
 * LoadingCard — the "please wait" reading page shown while the board reloads
 * (a movement, a sleep, an executed event). Renders the fixed "loading" card
 * from data/images.json (via buildLoadingCard) as a book page, with Card's own
 * page-loading spinner spinning over the image.
 *
 * `story` is optional: when it carries a card, its picture and description
 * take over the fixed ones (the photo credits follow the image, so the right
 * author is credited). The title stays the "Loading…" one.
 *
 * `maxWidth` (a CSS size, e.g. "300px") caps the card's width and centers it
 * in its container; unset, the card fills all the available space.
 */
export default function LoadingCard({ variant = 'page', story = null, maxWidth = null }) {
  const { t } = useTranslation()
  const card = buildLoadingCard(t)
  if (story?.card?.urlImage) {
    card.urlImage = story.card.urlImage
    card.copyrightText = story.card.copyrightText ?? null
    card.linkCopyright = story.card.linkCopyright ?? null
    card.styleImageLarge = story.card.styleImageLarge ?? ''
  }
  if (story?.card?.description) card.description = story.card.description
  const page = (
    <Card variant={variant}
      card={card}
      entityType="loading"
      loading={true}
    />
  )
  return maxWidth ? <div style={{ maxWidth, margin: '0 auto', padding: '1rem' }}>{page}</div> : page
}

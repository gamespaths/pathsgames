import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { buildCardComa } from '@/utils/loadoutCards'

/**
 * Step 30 — ComaCard tells the player their life reached zero: they are comatose and
 * cannot act until another character rescues them (the rescue action itself is step 59).
 *
 * When `allPlayers` is true the whole party is down, and the story's own
 * `id_event_all_player_coma` card — passed as `comaEventCard` — is what the player should
 * read; this component then renders that card and falls back to its own copy only when
 * the story authored no epilogue.
 *
 * Same dual mode as WeatherCard: with `onBack` it is a full book reading page shown on
 * the right; without it, a small board card that opens the big one via `onPreview`.
 */
export default function ComaCard({
  story,
  allPlayers = false,
  comaEventCard = null,
  onPreview,
  onBack = null,
  onForward = null,
  previewSide = 'left',
  locked=false,lockInfo='',lockedIcon=''
}) {
  const { t } = useTranslation()

  // A party collapse and a personal coma are different news, so they get different copy.
  const fallbackTitle = allPlayers ? t('game.allComa.title') : t('game.coma.title')
  const fallbackDescription = allPlayers
    ? t('game.allComa.description')
    : t('game.coma.description')

  // The story's epilogue card wins on every field it fills — it is the narrative the
  // author wrote for this moment. buildCardComa supplies the image and credits, and our
  // own copy fills only the halves the author left blank.
  const card = { ...buildCardComa(t), ...(comaEventCard ?? {}) }
  card.title = comaEventCard?.title || fallbackTitle
  card.description = comaEventCard?.description || fallbackDescription

  if (onBack) {
    return (
      <Card
        variant="page"
        card={card}
        entityType="coma"
        story={story}
        loading={false}
        onClose={onBack}
        onForward={onForward ?? undefined}
        hidePreview
        locked={locked} lockInfo={lockInfo} lockedIcon={lockedIcon}
      />
    )
  }

  return (
    <Card
      card={card}
      entityType="coma"
      story={story}
      flagInformationCard={true}
      onPreview={() => onPreview?.(card, 'coma', null, [], true, null, previewSide)}
      locked={locked} lockInfo={lockInfo} lockedIcon={lockedIcon}
    />
  )
}

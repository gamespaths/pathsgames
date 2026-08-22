import { useTranslation } from '@/i18n/context'
import ItemCard from './ItemCard'

/**
 * ItemsCards — Step 34. The backpack page: one ItemCard per inventory row, on the RIGHT
 * page of the book.
 *
 * It owns no data of its own. The rows come from `playerStats.items`, which match-info
 * already carries with the resolved card of every item — so opening the backpack costs no
 * request, and what it shows can never disagree with the board that served it.
 *
 * Using an item answers the execute-event payload, so `onDone` is the board's own event
 * handler: an item that carries a SADNESS effect trips the Step 30 overflow exactly as an
 * event would, and the handler already knows how to narrate that.
 *
 * Nothing but the rows lives here: the bag's title, its capacity and the way back are on
 * the LEFT page (ItemsCard, page variant), so this page has no fixed header of its own.
 */
export default function ItemsCards({
  playerStats, story, onPreview, previewSide = 'right',
  matchUuid, accessToken, onDone, onDropped, onError,
}) {
  const { t } = useTranslation()
  const items = Array.isArray(playerStats?.items) ? playerStats.items : []

  return (
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list">
        {items.length === 0
          ? <p className="game-empty">{/*t('game.items.empty') it items empty don't show messages */}</p>
          : items.map(item => (
            <ItemCard key={item.uuid} item={item} story={story}
              onPreview={onPreview} previewSide={previewSide}
              playerStats={playerStats} matchUuid={matchUuid} accessToken={accessToken}
              onDone={onDone} onDropped={onDropped} onError={onError} />
          ))}
      </div>
    </div>
  )
}

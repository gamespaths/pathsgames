import RegistryKeyCard from './RegistryKeyCard'
import { visibleRegistry } from '@/utils/registry'
import { useTranslation } from '@/i18n/context'

/**
 * RegistryCards — Step 36. The registry page: one card per visible key, on the RIGHT page of
 * the book, in the same grid the backpack lays its items out in.
 *
 * It owns no data of its own. The rows come from `/info`, which already carries each key's
 * definition, so opening the registry costs no request and what it shows can never disagree
 * with the board that served it.
 *
 * The category is a badge on the card, not a heading over a section: a heading would break
 * the grid into stacked blocks, and the ordering already keeps a category's keys together.
 *
 * Nothing but the rows lives here: the title and the way back are on the LEFT page
 * (RegistryCard, page variant), exactly as the backpack is arranged.
 */
export default function RegistryCards({ registry, story, onPreview, previewSide = 'right' }) {
  const { t } = useTranslation()
  // Already sorted by category, then priority, then key — so the grid reads in groups
  // without needing a group element to say so.
  const rows = visibleRegistry(registry)

  return (
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list">
        {rows.length === 0
          ? <p className="game-empty">{t('game.registry.empty')}</p>
          : rows.map(entry => (
            <RegistryKeyCard key={entry.uuid ?? entry.key} entry={entry} story={story}
              onPreview={onPreview} previewSide={previewSide} />
          ))}
      </div>
    </div>
  )
}

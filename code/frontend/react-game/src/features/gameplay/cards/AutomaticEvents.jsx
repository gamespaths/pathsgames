import { useEffect, useState } from 'react'
import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { effectStatItems } from '@/utils/statBadges'

/**
 * Step 33 (v0.33.1) — the wake-up list on the book's RIGHT page.
 *
 * A time-start can exhaust several location counters at once, so this is always a **list** —
 * but read **one at a time**, not stacked: the player presses → and the next notice takes the
 * page, exactly as an arrival's automatic events and the weather change do (`showAutomaticEvents`
 * in GameBook chains the same forward arrow). The arrow on the last notice closes the whole
 * thing, because there is nothing behind it to go back to. Shown right after the sleep that
 * advanced the clock: the player falls asleep and wakes to find what changed in the world,
 * which is the moment they are already looking at the right page.
 *
 * Each entry carries three cards, and they are not interchangeable:
 *
 * - `cardEffects[].card` — what the event actually **did**. The board renders the first one,
 *   the same way `execute-event` renders an effect's own card rather than the event's: an
 *   effect is the sentence the player is meant to read.
 * - `card` — the event's own card. The fallback, for an event that applied nothing.
 * - `cardLocation` — the place. **Deliberately unused for now**: it arrives in the payload
 *   (so the fog-of-war contract stays one shape) but showing where a thing happened is a
 *   separate reading, not this list's job.
 *
 * The effects also carry `statistic`/`value`, and those become the same badges an executed
 * event earns — see `effectStatItems`, which explains why this reading is the authored value
 * rather than the clamped delta the board shows elsewhere.
 *
 * `visibility` is decided by the server **for this player**, and the three readings are
 * genuinely different news:
 *
 * - `FULL` — they are standing there. The place is named and the event is theirs.
 * - `NAMED` — they have been there before. The place is named; they were not present.
 * - `ANONYMOUS` — they have never been there. **No card is in the payload at all**, not
 *   merely hidden here: a counter runs down even where nobody has ever set foot, and naming
 *   it would hand the player the map. So the notice says only that *something* happened
 *   somewhere, which is exactly what the player is entitled to know — and no badges either,
 *   since a stat change would say what happened there.
 *
 * Rendered as reading pages (`variant="page"`): this is something to read, not a set of
 * things to choose between.
 */
export default function AutomaticEvents({ story, items = [], onPreview, onDismiss, playerUuid = null }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)

  // A later sleep brings its own notices: start reading from the first one again.
  useEffect(() => { setIndex(0) }, [items])

  const item = items[index]
  if (!item) return null

  const anonymous = item?.visibility === 'ANONYMOUS'
  // Without a card there is nothing to preview: the anonymous notice is the whole
  // message, and it must not offer a lens onto a place the player cannot know.
  const card = anonymous
    ? { title: t('game.automaticEvents.anonymous'), awesomeIcon: 'fas fa-hourglass-end' }
    : firstEffectCard(item) ?? item?.card
      ?? { title: t('game.automaticEvents.title'), awesomeIcon: 'fas fa-hourglass-end' }

  const last = index >= items.length - 1
  const onForward = last ? () => onDismiss?.() : () => setIndex(i => i + 1)

  return (

        <Card
          key={item?.eventUuid ?? `${item?.idLocation}-${index}`}
          variant="page"
          card={card}
          entityType="automatic-event"
          story={story}
          statItemsToPageContent={anonymous ? [] : effectStatItems(item?.cardEffects, playerUuid, t)}
          onForward={onForward}
          //onPreview={anonymous ? undefined : onPreview}
          //previewSide="right"
          //hidePreview={anonymous}
        />

  )
}

/**
 * The first effect card the entry carries, or null. First rather than last: the effects
 * arrive in the order the chain applied them, so the first is where the news starts.
 */
export function firstEffectCard(item) {
  return (item?.cardEffects ?? []).map(e => e?.card).find(Boolean) ?? null
}

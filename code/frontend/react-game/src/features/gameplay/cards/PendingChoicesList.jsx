import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import ChoiceCard from './ChoiceCard'

/**
 * Step 31 — the right-page list of a choice-event's options.
 *
 * Rendered on the book's RIGHT page (the same small-card grid the board uses) while the
 * event card sits on the LEFT page. Every option is a {@link ChoiceCard} — disabled ones
 * included, greyed with their reason. A final "do nothing" card ends the event without
 * choosing: the same effect as the back arrow on the event card (the cost stays paid).
 *
 * The whole list disappears when the choice-event is closed (`onDoNothing`, or the event
 * card's back arrow in the parent).
 *
 * Step 32 — `busy` is true while a select-choice call is in flight: every option locks,
 * so a second click cannot resolve a cycle the first one is already closing.
 */
export default function PendingChoicesList({
  story, choices = [], onPreview, onSelect, onDoNothing, busy = false,
}) {
  const { t } = useTranslation()

  return (
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list">
        {choices.map((choice) => (
          <ChoiceCard

            key={choice.uuid ?? choice.name}
            choice={choice}
            story={story}
            onPreview={onPreview}
            previewSide="right"
            onSelect={onSelect}
            busy={busy}
          />
        ))}

        {/* The always-offered "do nothing" exit — same effect as the event card's back
            arrow. No lens: there is nothing to preview, only to dismiss.

          DO NOT REMOVE THIS 
        <Card
          card={{ title: t('game.choices.doNothing'), awesomeIcon: 'fas fa-ban' }}
          entityType="choice-none"
          story={story}
          onAction={() => onDoNothing?.()}
          actionLabel={t('game.choices.doNothing')}
          actionIcon="fa-ban"
          hidePreview
        /> */}
      </div>
    </div>
  )
}

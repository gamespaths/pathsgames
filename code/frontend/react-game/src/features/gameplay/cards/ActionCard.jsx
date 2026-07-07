import Card from '@/components/layout/Card'

/**
 * ActionCard — a location action card (WIP). Modeled on MovementCard: one card
 * per non-end-game action available at the active location.
 *
 * For now it only surfaces the action's card with the (i) preview routed to the
 * chosen book page (`previewSide`) — it does not execute anything yet. In the
 * future it will grow like MovementCard: an energy (and/or item) cost, a
 * locked/affordable state, and an action button that calls the gameplay
 * "perform action" endpoint and reloads the board. The `playerStats`, `matchUuid`,
 * `accessToken`, `onDone` and `onError` props are already threaded through so
 * that evolution needs no wiring change in GameBook.
 */
export default function ActionCard({
  action, story, onPreview, previewSide = 'left',
  // Reserved for the upcoming "perform action" flow (see MovementCard):
  playerStats, matchUuid, accessToken, onDone, onError, // eslint-disable-line no-unused-vars
}) {
  const cardData = action?.card ?? {
    title: action?.name, description: action?.description,
    urlImage: action?.urlImage, awesomeIcon: action?.awesomeIcon,
  }

  return (
    <Card
      card={cardData}
      entityType="action"
      // handleSelectionPreviewFull(card, type, lockReason, statistics, showModal, additionalProps, side)
      onPreview={() => onPreview(action?.card ?? null, 'action', null, [], true, {}, previewSide)}
      story={story}
      flagInformationCard={true}
    />
  )
}

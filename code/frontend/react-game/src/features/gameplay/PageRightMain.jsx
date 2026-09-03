import Card from '@/components/layout/Card'
import PlayerStats from './cards/PlayerStats'
import ComaCard from './cards/ComaCard'
import GoToSleepCard from './cards/GoToSleepCard'
import MovementCard from './cards/MovementCard'
import ActionCard from './cards/ActionCard'
import EndGameCard from './cards/EndGameCard'
import { buildCardCharacteristics, checkShowToSleepCard, movementCostKey } from '@/utils/gamebook'
import { SHOW_CARD_CHARACTERISTICS, SHOW_MOBILE_CARD_CHARACTERISTICS, hideWhereClass } from '@/constants/features'

/**
 * PageRightMain — the RIGHT page when nothing else owns it: the characteristics card, the
 * coma/sleep warnings, one move-target card per neighbor and one card per action here.
 */
export default function PageRightMain({
  story, storyFull, t, gameData, playerStats, clock, weather, locations, actions,
  locationCosts, hereLocationId, matchUuid, accessToken, endError,
  sleepCardForced, onForceSleepCard, onPreview, onOpenMap, onOpenItems, onOpenRegistry,
  onOpenInfo,
  onMoved, onDone, onSlept, onError, onEndGame, onEndGamePreview,
}) {
  const cardCharacteristics = buildCardCharacteristics(story, playerStats, clock, weather)
  // Show the sleep card only when the player is energy-stuck: every available movement and
  // action costs more energy than they have — or when the bed button asked for it.
  const showSleep = checkShowToSleepCard({ playerStats, locations, actions, locationCosts, hereLocationId })
    || sleepCardForced
  const comingSoon = () => { alert('Missions coming soon!') }

  return (
    <>
      <div className="config-view-wrap config-view--config">
        <div className="config-cards-area selection-list">
          {(SHOW_CARD_CHARACTERISTICS || SHOW_MOBILE_CARD_CHARACTERISTICS) &&
            <Card card={cardCharacteristics} entityType="information" story={story}
              flagInformationCard={true} previewSide="right"
              additionalCardClasses={hideWhereClass(SHOW_CARD_CHARACTERISTICS, SHOW_MOBILE_CARD_CHARACTERISTICS)}
              infoLabel={''} infoIconClassName="fas fa-info-circle font-size-medium m-1"
              infoLabelClassName="font-size-medium display-none"
              actionLabel={''} actionIcon="fa-bed m-1" onAction={onForceSleepCard}
              actionsList={[
                { label: '', icon: 'fa-map m-1', onAction: onOpenMap },
                { label: '', icon: 'fa-clipboard-list m-1', onAction: comingSoon },
                { label: '', icon: 'fa-scroll m-1', onAction: onOpenRegistry },
                { label: '', icon: 'fa-suitcase m-1', onAction: onOpenItems },
                //NEVER REMOVE THIS COMMENTS!
                //{ label: '', icon: 'fa-people-arrows m-1', onAction: () => { alert('Items, missions and registry coming soon!') } },
              ]}
              onPreview={onOpenInfo}
              childrenIntoImage={<PlayerStats stats={playerStats} plainFlag={false} showLabel={false}
                showGrid2={true} showItems={false}
                className="m-1 display-inline-grid flex-direction-column display-grid2" />}
            />}
            
          {playerStats?.isComa && <ComaCard story={story} onPreview={onPreview} previewSide="right" />}

          { /* Step 28 — for every neighbor-location render a move-target card */ }
          {(locations ?? []).map(loc => (
            <MovementCard key={loc.uuid ?? loc.idLocation} location={loc}
              totalEnergyCost={loc.uuid != null && hereLocationId != null
                ? locationCosts[movementCostKey(hereLocationId, loc.uuid)]
                : undefined}
              playerStats={playerStats} story={story} onPreview={onPreview}
              previewSide="right" matchUuid={matchUuid} accessToken={accessToken}
              onMoved={onMoved} onError={onError} />
          ))}

          { /* for every action in location — end-game events expose an "end game" button */ }
          {(actions ?? []).map(action => action.endGame
            ? <EndGameCard key={action.uuid} story={story} action={action}
                handleEndGamePreviewFull={onEndGamePreview} handleEndGame={onEndGame} />
            : <ActionCard key={action.uuid} action={action} story={story}
                onPreview={onPreview} previewSide="right"
                playerStats={playerStats} matchUuid={matchUuid} accessToken={accessToken}
                onDone={onDone} onError={onError} />
          )}
          { /* Last of the board's cards: resting is what buys back whatever the moves and
               actions above are asking more energy for, so it reads after them. */ }
          {showSleep &&
            <GoToSleepCard story={story} storyFull={storyFull} gameData={gameData}
              playerStats={playerStats} onPreview={onPreview} previewSide="right"
              matchUuid={matchUuid} accessToken={accessToken} onSlept={onSlept}
              autoPreview={sleepCardForced} />}
          { /* Step 34 — the inventory used to be listed here, next to the actions. It has
               its own page now (ItemsCards on the right, opened by the flask button or by
               ItemsCard in the statistics list), so keeping the list here too would show
               every item twice. */ }
          <div className="sleep-action-row" />
        </div>
      </div>
      {endError && (
        <p className="game-error end-game-error">
          <i className="fas fa-exclamation-triangle me-2" />{endError}
        </p>
      )}
    </>
  )
}

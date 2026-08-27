import WeatherCard from './cards/WeatherCard'
import GoToSleepCard from './cards/GoToSleepCard'
import MapCard from './cards/MapCard'
import ItemsCard from './cards/ItemsCard'
import PlayerCards from './cards/PlayerCards'
import { bagSummaryProps } from './js/boardProps'

/**
 * PageRightInfo — the (i) view's RIGHT page: the weather, the way to sleep, and the doors
 * to the map, the bag and the player's own cards. The LEFT page is the information page.
 */
export default function PageRightInfo({
  story, storyFull, gameData, playerStats, weather, matchUuid, accessToken,
  onPreview, onSlept, onOpenMap, onOpenItems, onPreviewMatchLog,
}) {
  return (
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list">
        <WeatherCard weather={weather} story={storyFull} onPreview={onPreview} previewSide="right" />
        <GoToSleepCard story={story} storyFull={storyFull} gameData={gameData}
          playerStats={playerStats} onPreview={onPreview} previewSide="right"
          matchUuid={matchUuid} accessToken={accessToken} onSlept={onSlept} />
        <MapCard onOpen={onOpenMap} />
        <ItemsCard onOpen={onOpenItems} {...bagSummaryProps(playerStats)} />
        <PlayerCards storyFull={storyFull} story={story} playerStats={playerStats}
          gameData={gameData} onPreview={onPreview} previewSide="right"
          onPreviewMatchLog={onPreviewMatchLog} />
      </div>
    </div>
  )
}

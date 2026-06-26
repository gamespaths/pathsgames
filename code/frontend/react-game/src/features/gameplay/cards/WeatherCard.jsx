import { useTranslation } from '@/i18n/context'
import Card from '@/components/layout/Card'
import { buildWeatherCard } from '@/utils/loadoutCards'
import BonusBadgeList from '@/components/ui/BonusBadgeList'

/**
 * Step 27 — WeatherCard renders the match's current weather right after the
 * sleep card. `weather` is the GET /api/matches/{uuid}/weather payload (or null
 * when no weather is set yet, e.g. before the match starts); in that case the
 * component renders nothing. Informational only: it opens the big card on the
 * left page / modal via `onPreview`.
 */
export default function WeatherCard({ weather, story, onPreview }) {
  const { t } = useTranslation()
  if (!weather) return null

  // Step 27 — prefer the real card resolved by the backend (image + name from the
  // story's weather card); fall back to the generic placeholder card when the
  // weather has no idCard / the backend didn't resolve one.
  const card = weather.card
    ? { ...weather.card }
    : buildWeatherCard(weather, t)
  if (!card.title) card.title = t('game.weather.title')
  //const delta = weather.deltaEnergy ?? 0
  //const statItems = delta
  //  ? [{ key: 'energy', value: `${delta > 0 ? '+' : ''}${delta}`, label: t('game.weather.energyDelta') }]
  //  : []
  const costItems = weather.costMoveSafeLocation>0 ?
    [{ key: 'energy', value: '+' + weather.costMoveSafeLocation, label: t('game.movement.moveCost') }]
    : []
  const costBadge = (
    <BonusBadgeList items={costItems} 
      className="player-stats-bar bonus-badge-list m-1 display-flex flex-direction-column" />
  ) 
  //console.log("WeatherCard", weather, card, costItems, costItems, costBadge);

  return (
    <Card
      card={card}
      entityType="weather"
      story={story}
      flagInformationCard={true}
      childrenIntoImage={costBadge}
      onPreview={() => onPreview?.(card, 'weather', null, costItems, true)}
    />
  )
}

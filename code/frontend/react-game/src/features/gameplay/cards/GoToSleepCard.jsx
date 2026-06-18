import { useState } from 'react'
import { useTranslation } from "@/i18n/context"
import Card from '@/components/layout/Card'
import PlayerStats from './PlayerStats'
import { sleepCharacter } from '@/api/matches'
import { buildCardToSleep } from '@/utils/loadoutCards'


export default function GoToSleepCard({ story, playerStats, onPreview, matchUuid, accessToken, onSlept }) {

  //console.log("GoToSleepCard", playerStats , story , onPreview, playerStats.energy, playerStats.energyMax);
  const { t } = useTranslation()
  const [sleeping, setSleeping] = useState(false)

  // Sleep the caller's character; on success let the parent (GameBook) refresh
  // the clock and reload the board. Backend 409s (ALREADY_SLEEPING /
  // NOT_YOUR_TURN / MATCH_NOT_RUNNING) bubble up via the rejected promise.
  async function handleSleep() {
    if (sleeping || !matchUuid) return
    setSleeping(true)
    try {
      const result = await sleepCharacter(matchUuid, accessToken)
      onSlept?.(result)
    } catch (e) {
      console.error('sleep failed', e?.response?.data?.error || e?.message)
    } finally {
      setSleeping(false)
    }
  }
  //const card=buildStatisticsCard(t('game.sleep'), aggregateBonusTotals(playerStats), 'fa-bed');
  const cardRight=buildCardToSleep(story, playerStats, t);
  const cardLeft={...cardRight};
  const energyObject={energy: playerStats.energy, energyMax: playerStats.energyMax};
  //cardLeft.title=energyBadge ;
  //cardRight.title=<><span className="clock-widget-title">{cardRight.title}</span>{energyBadge}</>
  return <Card
    card={cardLeft}
    entityType="sleep"
    label={t('game.sleep')}
    onAction={handleSleep}
    actionLabel={t('game.sleep.action')}
    actionIcon= 'fa-bed'
    onPreview={() => {
      onPreview(cardRight, 'sleep', null,
      [{ key: 'energy', value: "" + energyObject.energy + "/" + energyObject.energyMax, label: t(`book.stats.totals.energy`) }],
      true,
      {onAction: handleSleep, actionLabel: t('game.sleep.action'), actionIcon: 'fa-bed' });
    }}
    story={story}
    flagInformationCard={true}
    actionOnlyIfPreview={true}
    actionWithInfo={true}
    childrenIntoImage={<PlayerStats stats={energyObject} plainFlag={false} showZeros={false} className="m-1 pl-2 display-inline-grid flex-direction-column" />}
    />

}

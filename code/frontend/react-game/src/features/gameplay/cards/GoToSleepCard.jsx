import { useEffect, useState } from 'react'
import { useTranslation } from "@/i18n/context"
import Card from '@/components/layout/Card'
import PlayerStats from './PlayerStats'
import { sleepCharacter } from '@/api/matches'
import { buildCardToSleep } from '@/utils/loadoutCards'
import { resolveSelectionEntity } from '@/utils/gamebook'
import BonusBadgeList from '@/components/ui/BonusBadgeList'


export default function GoToSleepCard({ story, storyFull,gameData,playerStats, onPreview, previewSide='left', matchUuid, accessToken, onSlept, autoPreview=false}) {
  const { t } = useTranslation()
  const [sleeping, setSleeping] = useState(false)
  //console.log("GoToSleepCard gameData",gameData);
  //console.log("GoToSleepCard", playerStats , story ,storyFull, onPreview, playerStats.energy, playerStats.energyMax);
  
  const locationsActive=gameData?.info?.locationsActive?.[0] ?? {};
  const difficultyEnergy=resolveSelectionEntity(storyFull, playerStats, gameData, 'difficulty')?.energy ?? null;
  const dex=playerStats.dexterity ?? null;
  const secureParam=locationsActive.secureParam ?? null;
  const energyObject={energy: playerStats.energy, energyMax: playerStats.energyMax};

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
  
  //const energySleep=gameData?.difficulty?.energy ?? 0
  //console.log("gameData",gameData);
  //cardLeft.title=energyBadge ;
  //cardRight.title=<><span className="clock-widget-title">{cardRight.title}</span>{energyBadge}</>

  const isSafe = secureParam != null && secureParam > 0;
  //`P` is defined as `secure_param + difficulty.energy`.
  // - Safe location: `energy += DEX + P`, `life += COS + secure_param`, `sadness -= INT + secure_param`.
  const energyRecovered = isSafe && difficultyEnergy != null && dex != null
    ? difficultyEnergy + secureParam + dex
    : difficultyEnergy;
  const statItems= isSafe ? [ { key: 'energy', value: "" + energyRecovered, label: null }
      ,{ key: 'life', value: "" + ((playerStats.dexterity ?? 0) + secureParam), label: null }
      ,{ key: 'sadness', value: "" + (secureParam + (playerStats.intelligence ?? 0)), label: null }
   ]
   : [{ key: 'energy', value: "" + energyRecovered }];
  const sleepSecureContentBadge=<BonusBadgeList items={statItems} className="book-page-stats mb-0 display-ruby flex-direction-column" />;
  const sleepSecureContent = (
    <div className="sleep-secure-info">
      {isSafe
        ? <span>{t('game.sleep.safeLocation')} <strong>{sleepSecureContentBadge}</strong></span>
        : <span>{t('game.sleep.unsafeLocation')} <strong>{sleepSecureContentBadge}</strong></span>
      }
    </div>
  );

  // The sleep reading page, asked for by the (i) lens or — when the board's bed button
  // opened this card on purpose (autoPreview) — as soon as the card is on screen.
  function openSleepPreview() {
    onPreview({
      card: cardRight,
      type: 'sleep',
      stats: [],
      side: previewSide,
      props: { onAction: handleSleep, actionLabel: t('game.sleep.action'), actionIcon: 'fa-bed',
        extraContent: sleepSecureContent, extraContentClassName: '' },
    })
  }
  useEffect(() => { if (autoPreview) openSleepPreview() }, [autoPreview]) // eslint-disable-line react-hooks/exhaustive-deps

  return <Card
    card={cardLeft}
    entityType="sleep"
    label={t('game.sleep')}
    onAction={handleSleep}
    actionLabel={t('game.sleep.action')}
    actionIcon= 'fa-bed'
    onPreview={openSleepPreview}
    story={story}
    flagInformationCard={true}
    actionOnlyIfPreview={true}
    actionWithInfo={true}
    childrenIntoImage={<PlayerStats stats={energyObject} plainFlag={false} showZeros={false} 
      className="m-1 pl-2 display-inline-grid flex-direction-column" />}
    infoIconClassName={location?.awesomeIcon ?? location?.card?.awesomeIcon ?? "fas fa-bed"}
    infoLabel={t('game.sleep.action')}
    />


}

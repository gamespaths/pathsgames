import images from '@/mock/images.json'

/**
 * Builders for the two non-selectable loadout cards shown in the start book —
 * the game type ("Single") and the login mode ("Guest"). They are shared by
 * `ConfigView` (start book) and `StartMatchPage` so both render an identical
 * pair of cards.
 */

const imgById = id => images.find(x => x.id === id)

/** Map an entry of mock/images.json onto the `card` shape Card expects. *//** Map an entry of mock/images.json onto the `card` shape GameCard expects. */
function metaCard(imgId , title=null, description=null) {  
  const img = imgById(imgId)
  if (!img) return {}
  return {
    urlImage: img.urlImage,
    copyrightText: img.copyrightText,
    linkCopyright: img.linkCopyright,
    styleImageLarge: img.styleImageLarge,
    styleImageLittle: img.styleImageLittle,
    title: title ?? null,
    description: description ?? null,
    awesomeIcon: img.awesomeIcon ?? null,
  }
}

/** "Single" game-type card. `t` is the i18n translate function. */
export function buildGameTypeCard(t) {
  return metaCard('person', t('book.single'), t('book.singleDesc'))
}

export function buildCardToSleep(story, playerStats, t) {
  //console.log("buildCardToSleep", story, playerStats, t);
  const card = metaCard('sleep', t('game.sleep.confirmTitle'), t('game.sleep.confirmBody') );
  //card.description = "" /*+ t('game.sleep.confirmTitle')*/ + " " + t('game.sleep.confirmBody') /*+ ` (${playerStats.energy ?? 0}/${playerStats.energyMax ?? 0} ${t('game.stats.energy')})`*/
  return card
}

export function buildEndGameCard(t) {
  return metaCard('endgame', t('game.endGameCard.title'), t('game.endGameCard.description'));
}

/**
 * Step 27 — weather card shown after the sleep card. `weather` is the
 * GET /api/matches/{uuid}/weather payload (or null when none is set). The
 * description appends the energy delta applied to every character at time-start.
 */
export function buildWeatherCard(weather, t) {
  const card = metaCard('weather', t('game.weather.title'), t('game.weather.description'));
  const delta = weather?.deltaEnergy ?? 0;
  if (delta) {
    const sign = delta > 0 ? '+' : '';
    card.description = `${card.description} (${t('game.weather.energyDelta')}: ${sign}${delta})`;
  }
  return card;
}

/** "Guest" login card. `t` is the i18n translate function. */
export function buildLoginCard(t) {
  return metaCard('gems', t('book.guest'), t('book.guestDesc'));
}

/** Terms & conditions card shown first in the start-game confirmation. */
export function buildTermsCard(t) {
  return metaCard('terms', t('book.termsTitle'), t('book.termsDesc'));
}

/** "Antibot passed" card revealed once the Turnstile check succeeds. */
export function buildAntibotCard(t) {
  return metaCard('antibot', t('book.antibotOk'), t('book.antibotDesc'));
}

/** "Free to play" card revealed once the Turnstile check succeeds. */
export function buildFreeToPlay(t) {
  return metaCard('freeToPlay', t('book.freeToPlay'), t('book.freeToPlayDesc'));
}

/** "No traits selected" placeholder card shown in ConfigView when selectedTraits is empty. */
export function buildNoTraitsCard(t) {
  return metaCard('noTraits', t('book.noTraitsTitle'), t('book.noTraitsDesc'))
}

export function buildStatisticsCard(t, totals , story) {
  const personCard=metaCard('person');
  personCard.statItemsToPageContent = totals.map(({ category, value }) => ({
    key: category,
    label: t(`book.stats.totals.${category}`),
    value,
  }))
  //personCard.urlImage=story?.card?.urlImage ?? null; // use the story image if available, otherwise fallback to the default person image 
  personCard.urlImage=null;
  return {
    name: t('book.stats.title'),
    //icon: 'fas fa-chart-bar',
    card: personCard,//card: metaCard('statistics'),
    description: t('book.stats.statisticsDesc'),
    totals,
  }
}
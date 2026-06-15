import images from '@/mock/images.json'

/**
 * Builders for the two non-selectable loadout cards shown in the start book —
 * the game type ("Single") and the login mode ("Guest"). They are shared by
 * `ConfigView` (start book) and `StartMatchPage` so both render an identical
 * pair of cards.
 */

const imgById = id => images.find(x => x.id === id)

/** Map an entry of mock/images.json onto the `card` shape GameCard expects. */
function metaCard(imgId) {
  const img = imgById(imgId)
  if (!img) return {}
  return {
    urlImage: img.urlImage,
    copyrightText: img.copyrightText,
    linkCopyright: img.linkCopyright,
    styleImageLarge: img.styleImageLarge,
  }
}

/** "Single" game-type card. `t` is the i18n translate function. */
export function buildGameTypeCard(t) {
  return {
    name: t('book.single'),
    card: metaCard('person'),
    description: t('book.singleDesc'),
  }
}

/** "Guest" login card. `t` is the i18n translate function. */
export function buildLoginCard(t) {
  return {
    name: t('book.guest'),
    card: metaCard('gems'),
    description: t('book.guestDesc'),
  }
}

/** Terms & conditions card shown first in the start-game confirmation. */
export function buildTermsCard(t) {
  return {
    name: t('book.termsTitle'),
    icon: 'fas fa-scroll',
    card: metaCard('terms'),
    description: t('book.termsDesc'),
  }
}

/** "Antibot passed" card revealed once the Turnstile check succeeds. */
export function buildAntibotCard(t) {
  return {
    name: t('book.antibotOk'),
    icon: 'fas fa-shield-alt',
    card: metaCard('antibot'),
    description: t('book.antibotDesc'),
  }
}

/** "Free to play" card revealed once the Turnstile check succeeds. */
export function buildFreeToPlay(t) {
  return {
    name: t('book.freeToPlay'),
    icon: 'fas fa-gift',
    card: metaCard('freeToPlay'),
    description: t('book.freeToPlayDesc'),
  }
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
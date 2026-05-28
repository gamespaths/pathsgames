import images from '../../mock/images.json'

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

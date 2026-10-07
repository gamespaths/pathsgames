import comingSoon from '../data/stories.json'

/**
 * Catalog teasers shipped with the build (data/stories.json), shown only when
 * ADD_COMING_SOON_STORIES is on. They carry `comingSoon: true`, which the card
 * turns into a "Coming Soon" label instead of the Play button.
 */
export function comingSoonStories(lang) {
  return comingSoon.map(({ translations, ...story }) => ({
    ...story,
    ...(translations?.[lang] ?? {}),
    comingSoon: true,
  }))
}

/** The API catalog with the teasers appended, or the API list untouched when `add` is false. */
export function withComingSoonStories(stories, lang, add) {
  const list = Array.isArray(stories) ? stories : []
  return add ? [...list, ...comingSoonStories(lang)] : list
}

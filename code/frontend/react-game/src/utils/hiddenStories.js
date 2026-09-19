import hidden from '../data/hidden-stories.json'

/**
 * v0.38.1 — catalog blacklist shipped with the build (data/hidden-stories.json): the
 * Robot seed/demo stories that sit on the AWS test backend while a run is in progress.
 */
const norm = (v) => String(v ?? '').trim().toLowerCase()
const asSet = (list) => new Set((Array.isArray(list) ? list : []).map(norm).filter(Boolean))

/** The three match sets from a data file; a missing or malformed list counts as empty. */
export function compileHiddenLists(json) {
  return { uuids: asSet(json?.uuids), authors: asSet(json?.authors), categories: asSet(json?.categories) }
}

const LISTS = compileHiddenLists(hidden)

/** True when the story matches one of the lists (uuid, author or category). */
export function isHiddenStory(story, lists = LISTS) {
  if (!story) return false
  return lists.uuids.has(norm(story.uuid))
    || lists.authors.has(norm(story.author))
    || lists.categories.has(norm(story.category))
}

/** The catalog without the blacklisted stories, or untouched when `hide` is false. */
export function withoutHiddenStories(stories, hide = true) {
  const list = Array.isArray(stories) ? stories : []
  return hide ? list.filter(s => !isHiddenStory(s)) : list
}

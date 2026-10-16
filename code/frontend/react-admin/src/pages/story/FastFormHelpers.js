/**
 * FastFormHelpers — form utilities, text + card writer (max+1 ids) and rollback shared by the
 * Fast New Event and Fast New Locations pages.
 */
import { createEntity, deleteEntity, listEntities } from '../../api/storyApi'
import { withHtmlLineBreaks } from '../../utils/htmlLineBreaks'

// A green save report hides itself after this delay; a failed one stays until closed.
export const SUMMARY_HIDE_MS = 8000

// Text + card fields shared by every element of the fast forms.
export const emptyTextBlock = () => ({
  titleEn: '', titleIt: '', descEn: '', descIt: '', copyright: '', link: '', urlImage: '',
})

/** Returns a copy of `obj` with the value at `path` (array of keys/indexes) replaced. */
export function setIn(obj, path, value) {
  if (!path.length) return value
  const [head, ...rest] = path
  const copy = Array.isArray(obj) ? [...obj] : { ...obj }
  copy[head] = setIn(obj?.[head], rest, value)
  return copy
}

export const isFilled = (value) => value !== null && value !== undefined && String(value).trim() !== ''

/** '' / invalid → null, otherwise the number. */
export function toNumber(value) {
  if (!isFilled(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const toText = (value) => (isFilled(value) ? String(value).trim() : null)

/** Drops null / undefined / '' values so the backends only receive what was typed. */
export function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => isFilled(v)))
}

const maxOf = (values) => {
  const numbers = values.map(Number).filter(Number.isFinite)
  return numbers.length ? Math.max(...numbers) : 0
}

/** First finite numeric value among `keys` of a backend response, else `fallback`. */
export const pickId = (response, keys, fallback = null) => {
  for (const key of keys) {
    const parsed = toNumber(response?.[key])
    if (parsed !== null) return parsed
  }
  return fallback
}

/** Children cannot be linked without the parent id, so a missing one aborts the save. */
export const requireId = (id, what) => {
  if (id === null || id === undefined) throw new Error(`The backend returned no id for the new ${what}`)
  return id
}

/**
 * Loads texts and cards for the max+1 ids and returns the writers of one save.
 * `created` lists every entity written, in order, for the report and the rollback.
 */
export async function openFastSave(storyUuid, story) {
  const created = []
  const idCreator = toNumber(story?.idCreator)

  const [texts, cards] = await Promise.all([
    listEntities(storyUuid, 'texts'),
    listEntities(storyUuid, 'cards'),
  ])
  let nextTextId = maxOf((texts || []).map(t => t.idText)) + 1
  let nextCardId = maxOf((cards || []).map(c => c.idCard ?? c.id)) + 1

  const create = async (entityType, payload, label) => {
    const response = await createEntity(storyUuid, entityType, payload)
    created.push({ entityType, uuid: response?.uuid ?? null, label })
    return response
  }

  // One text id, EN row always, IT row only when typed. Returns null when EN is empty.
  const createText = async (en, it, format = (v) => v) => {
    if (!isFilled(en)) return null
    const idText = nextTextId++
    for (const [lang, shortText] of [['en', en], ['it', it]]) {
      if (!isFilled(shortText)) continue
      await create('texts', compact({
        id: idText, idText, lang, shortText: format(String(shortText).trim()), longText: '', idCreator,
      }), `Text #${idText} (${lang})`)
    }
    return idText
  }

  // Title, description and copyright texts plus the card that shows them.
  const createTextsAndCard = async (block) => {
    const idTitle = await createText(block.titleEn, block.titleIt)
    // Descriptions only: newlines get a <br /> as in the Fast Text Creator.
    const idDesc = await createText(block.descEn, block.descIt, withHtmlLineBreaks)
    const idCopyright = await createText(block.copyright, '')
    const sentIdCard = nextCardId++
    const card = await create('cards', compact({
      idCard: sentIdCard,
      idTextName: idTitle,
      idTextTitle: idTitle,
      idTextDescription: idDesc,
      idTextCopyright: idCopyright,
      linkCopyright: toText(block.link),
      urlImage: toText(block.urlImage),
      idCreator,
    }), `Card #${sentIdCard}`)
    // AWS rewrites idCard with its own max+1, so the response wins over what was sent.
    const idCard = pickId(card, ['idCard', 'id'], sentIdCard)
    if (idCard >= nextCardId) nextCardId = idCard + 1
    return { idTitle, idDesc, idCard }
  }

  // Renames the last written entity once its database id is known.
  const relabelLast = (label) => { created[created.length - 1].label = label }

  return { created, create, createText, createTextsAndCard, relabelLast }
}

/** Deletes `created` in reverse order; returns the entries that could not be deleted. */
export async function rollback(storyUuid, created) {
  const orphans = []
  for (const item of [...created].reverse()) {
    if (!item.uuid) {
      orphans.push(item)
      continue
    }
    try {
      await deleteEntity(storyUuid, item.entityType, item.uuid)
    } catch {
      orphans.push(item)
    }
  }
  return orphans
}

/** Rolls `created` back and builds the `{ ok: false }` outcome of a failed save. */
export async function failedSave(storyUuid, created, err) {
  const orphans = await rollback(storyUuid, created)
  const error = err?.response?.data?.message || err?.message || 'Save failed'
  return { ok: false, error, created, orphans }
}

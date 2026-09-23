/**
 * FastNewEventHelpers — form model and save logic of the Fast New Event page.
 * Creates texts, cards, event, effect or choices in order and rolls everything back on failure.
 */
import { createEntity, deleteEntity, listEntities } from '../../api/storyApi'
import { withHtmlLineBreaks } from '../../utils/htmlLineBreaks'

export const FAST_EVENT_CHOICES = 5
export const MODE_EFFECT = 'effect'
export const MODE_CHOICE = 'choice'
// A green save report hides itself after this delay; a failed one stays until closed.
export const SUMMARY_HIDE_MS = 8000

// Text + card fields shared by every element of the form.
export const emptyTextBlock = () => ({
  titleEn: '', titleIt: '', descEn: '', descIt: '', copyright: '', link: '', urlImage: '',
})

export const emptyEffect = () => ({
  ...emptyTextBlock(),
  statistics: '', value: '', target: '', keyToAdd: '', keyValueToAdd: '', idLocation: '',
})

export const emptyChoice = () => ({
  ...emptyTextBlock(),
  priority: '',
  condition: { type: '', key: '', value: '', operator: '' },
  effect: {
    ...emptyTextBlock(),
    statistics: '', value: '', key: '', valueToAdd: '', valueToRemove: '', idLocation: '',
  },
})

export const emptyFastEventForm = () => ({
  ...emptyTextBlock(),
  idSpecificLocation: '',
  costEnery: '',
  type: 'NORMAL',
  registryKeyCondition: '',
  registryValueCondition: '',
  registryValueOperatorCondition: '',
  mode: MODE_EFFECT,
  effect: emptyEffect(),
  choices: Array.from({ length: FAST_EVENT_CHOICES }, emptyChoice),
})

/** Returns a copy of `obj` with the value at `path` (array of keys/indexes) replaced. */
export function setIn(obj, path, value) {
  if (!path.length) return value
  const [head, ...rest] = path
  const copy = Array.isArray(obj) ? [...obj] : { ...obj }
  copy[head] = setIn(obj?.[head], rest, value)
  return copy
}

const isFilled = (value) => value !== null && value !== undefined && String(value).trim() !== ''

/** '' / invalid → null, otherwise the number. */
export function toNumber(value) {
  if (!isFilled(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const toText = (value) => (isFilled(value) ? String(value).trim() : null)

/** Drops null / undefined / '' values so the backends only receive what was typed. */
export function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => isFilled(v)))
}

export const isChoiceFilled = (choice) => isFilled(choice?.titleEn)
export const isConditionFilled = (condition) => isFilled(condition?.type) && isFilled(condition?.key)
export const isChoiceEffectFilled = (effect) => isFilled(effect?.titleEn)

/** Returns the list of blocking errors (empty = the form can be saved). */
export function validateFastEvent(form) {
  const errors = []
  if (!isFilled(form?.titleEn)) errors.push('Event: English title is required')
  if (form?.mode === MODE_EFFECT && !isFilled(form?.effect?.titleEn)) {
    errors.push('Effect: English title is required')
  }
  if (form?.mode === MODE_CHOICE && !(form?.choices || []).some(isChoiceFilled)) {
    errors.push('Choices: at least one choice with an English title is required')
  }
  return errors
}

const maxOf = (values) => {
  const numbers = values.map(Number).filter(Number.isFinite)
  return numbers.length ? Math.max(...numbers) : 0
}

// First finite numeric value among `keys` of a backend response, else `fallback`.
const pickId = (response, keys, fallback = null) => {
  for (const key of keys) {
    const parsed = toNumber(response?.[key])
    if (parsed !== null) return parsed
  }
  return fallback
}

// Children cannot be linked without the parent id, so a missing one aborts the save.
const requireId = (id, what) => {
  if (id === null) throw new Error(`The backend returned no id for the new ${what}`)
  return id
}

/**
 * Saves the whole form. Resolves { ok: true, created } or { ok: false, error, created, orphans },
 * where `created` lists every entity written and `orphans` what the rollback could not delete.
 */
export async function saveFastEvent({ storyUuid, story, form }) {
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

  try {
    const ev = await createTextsAndCard(form)
    const event = await create('events', compact({
      idCard: ev.idCard,
      idTextName: ev.idTitle,
      idTextDescription: ev.idDesc,
      idSpecificLocation: toNumber(form.idSpecificLocation),
      type: toText(form.type),
      costEnery: toNumber(form.costEnery),
      registryKeyCondition: toText(form.registryKeyCondition),
      registryValueCondition: toText(form.registryValueCondition),
      registryValueOperatorCondition: toText(form.registryValueOperatorCondition),
    }), 'Event')
    const idEvent = requireId(pickId(event, ['id', 'idEvent']), 'event')
    created[created.length - 1].label = `Event #${idEvent}`

    if (form.mode === MODE_EFFECT) {
      const fx = form.effect
      const t = await createTextsAndCard(fx)
      await create('event-effects', compact({
        idCard: t.idCard,
        idTextName: t.idTitle,
        idTextDescription: t.idDesc,
        idEvent,
        statistics: toText(fx.statistics),
        value: toNumber(fx.value),
        target: toText(fx.target),
        keyToAdd: toText(fx.keyToAdd),
        keyValueToAdd: toText(fx.keyValueToAdd),
        idLocation: toNumber(fx.idLocation),
      }), 'Event effect')
    } else {
      for (const [index, choice] of form.choices.entries()) {
        if (!isChoiceFilled(choice)) continue
        const t = await createTextsAndCard(choice)
        const saved = await create('choices', compact({
          idCard: t.idCard,
          idTextName: t.idTitle,
          idTextNarrative: t.idTitle,
          idEvent,
          priority: toNumber(choice.priority),
        }), `Choice ${index + 1}`)
        const idChoice = requireId(pickId(saved, ['id', 'idChoices']), 'choice')
        created[created.length - 1].label = `Choice ${index + 1} #${idChoice}`

        const cond = choice.condition
        if (isConditionFilled(cond)) {
          await create('choice-conditions', compact({
            idChoices: idChoice,
            type: toText(cond.type),
            key: toText(cond.key),
            value: toText(cond.value),
            operator: toText(cond.operator),
          }), `Choice ${index + 1} condition`)
        }

        const fx = choice.effect
        if (isChoiceEffectFilled(fx)) {
          const ft = await createTextsAndCard(fx)
          await create('choice-effects', compact({
            idCard: ft.idCard,
            idTextName: ft.idTitle,
            idText: ft.idDesc,
            idChoices: idChoice,
            idScelta: idChoice,
            statistics: toText(fx.statistics),
            value: toNumber(fx.value),
            key: toText(fx.key),
            valueToAdd: toText(fx.valueToAdd),
            valueToRemove: toText(fx.valueToRemove),
            idLocation: toNumber(fx.idLocation),
          }), `Choice ${index + 1} effect`)
        }
      }
    }
    return { ok: true, created }
  } catch (err) {
    const orphans = await rollback(storyUuid, created)
    const error = err?.response?.data?.message || err?.message || 'Save failed'
    return { ok: false, error, created, orphans }
  }
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

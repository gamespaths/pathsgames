/**
 * FastNewEventHelpers — form model and save logic of the Fast New Event page.
 * Creates texts, cards, event, effect or choices in order and rolls everything back on failure.
 */
import {
  emptyTextBlock, isFilled, toNumber, toText, compact, pickId, requireId, openFastSave, failedSave,
} from './FastFormHelpers'

export {
  SUMMARY_HIDE_MS, emptyTextBlock, setIn, toNumber, compact, rollback,
} from './FastFormHelpers'

export const FAST_EVENT_CHOICES = 5
export const MODE_EFFECT = 'effect'
export const MODE_CHOICE = 'choice'

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

/**
 * Saves the whole form. Resolves { ok: true, created } or { ok: false, error, created, orphans },
 * where `created` lists every entity written and `orphans` what the rollback could not delete.
 */
export async function saveFastEvent({ storyUuid, story, form }) {
  const { created, create, createTextsAndCard, relabelLast } = await openFastSave(storyUuid, story)

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
    relabelLast(`Event #${idEvent}`)

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
        relabelLast(`Choice ${index + 1} #${idChoice}`)

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
    return failedSave(storyUuid, created, err)
  }
}

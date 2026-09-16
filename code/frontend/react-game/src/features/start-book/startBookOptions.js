import { selectableTraits } from '../../utils/traitBudget'

/** Options of the start book offered for one loadout type (class, character, trait, difficulty). */
export function getOptionsForType(type, story) {
  if (type === 'difficulty') return story?.difficulties ?? []
  if (type === 'character') return story?.characterTemplates ?? []
  if (type === 'class') return story?.classes ?? []
  // v0.35.2 — hidden traits are dropped HERE and nowhere else: the same array feeds the
  // in-game list of the traits a character owns, where a hidden one must still appear.
  if (type === 'trait') return selectableTraits(story?.traits)
  return []
}

/** True when the story offers more than one option: the card gets "Change", else only "Info". */
export function hasChoiceForType(type, story) {
  return getOptionsForType(type, story).length > 1
}

/** The entity currently selected for a type in the loadout (traits: the first one). */
export function selectedEntityForType(type, config) {
  if (type === 'trait') return Array.isArray(config?.traits) ? config.traits[0] ?? null : null
  return config?.[type] ?? null
}

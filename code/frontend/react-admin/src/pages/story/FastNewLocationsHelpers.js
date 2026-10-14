/**
 * FastNewLocationsHelpers — form model, validation and save of the Fast New Locations page.
 * Creates locations (texts, card, location) then their neighbors, rolling back on failure.
 */
import {
  emptyTextBlock, isFilled, toNumber, toText, compact, pickId, requireId, openFastSave, failedSave,
} from './FastFormHelpers'

const NEW_PREFIX = 'new:'

export const emptyLocationRow = () => ({ ...emptyTextBlock(), energy: '' })

export const emptyNeighborRow = () => ({
  from: '', to: '', direction: '',
  conditionRegistryKey: '', conditionRegistryValue: '', registryValueOperatorCondition: '',
  energyCost: '', costFood: '', costMagic: '', costCoin: '', flagBack: '0',
})

export const emptyFastLocationsForm = () => ({ locations: [emptyLocationRow()], neighbors: [] })

/** From/To value pointing at the location row `index` of the form. */
export const newLocationRef = (index) => `${NEW_PREFIX}${index}`

/** Row index of a `new:N` reference, null for an existing location id or a blank value. */
export function newRefIndex(ref) {
  if (typeof ref !== 'string' || !ref.startsWith(NEW_PREFIX)) return null
  const index = Number(ref.slice(NEW_PREFIX.length))
  return Number.isInteger(index) && index >= 0 ? index : null
}

export const isLocationRowEmpty = (row) =>
  !Object.keys(emptyLocationRow()).some(key => isFilled(row?.[key]))

/** From/To options: the form rows first ("New N: title"), then story locations by descending id. */
export function buildEndpointOptions(rows, locationOptions) {
  const fresh = (rows || []).map((row, i) => ({
    value: newLocationRef(i),
    label: `New ${i + 1}: ${toText(row.titleEn) || '(no title)'}`,
  }))
  const existing = [...(locationOptions || [])]
    .sort((a, b) => Number(b.value) - Number(a.value))
    .map(opt => ({ value: String(opt.value), label: opt.label }))
  return [...fresh, ...existing]
}

/** Removes location row `index` and shifts or clears the neighbor references to the rows. */
export function removeLocationRow(form, index) {
  const remap = (ref) => {
    const n = newRefIndex(ref)
    if (n === null || n < index) return ref
    return n === index ? '' : newLocationRef(n - 1)
  }
  return {
    ...form,
    locations: form.locations.filter((_, i) => i !== index),
    neighbors: form.neighbors.map(nb => ({ ...nb, from: remap(nb.from), to: remap(nb.to) })),
  }
}

const directionKey = (from, direction) => `${from}/${String(direction).trim().toUpperCase()}`

/**
 * Returns the list of blocking errors (empty = the form can be saved).
 * `existingNeighbors` are the story rows already saved, checked for R2_NEIGHBOR_DUP.
 */
export function validateFastLocations(form, existingNeighbors = []) {
  const errors = []
  const rows = form?.locations || []
  const neighbors = form?.neighbors || []

  rows.forEach((row, i) => {
    if (!isLocationRowEmpty(row) && !isFilled(row.titleEn)) errors.push(`Location ${i + 1}: English title is required`)
  })
  if (rows.every(isLocationRowEmpty) && !neighbors.length) {
    errors.push('Add at least one location or one neighbor')
  }

  const taken = new Set((existingNeighbors || [])
    .filter(n => toNumber(n?.idLocationFrom) !== null && isFilled(n?.direction))
    .map(n => directionKey(toNumber(n.idLocationFrom), n.direction)))

  neighbors.forEach((nb, i) => {
    const label = `Neighbor ${i + 1}`
    if (!isFilled(nb.from) || !isFilled(nb.to) || !isFilled(nb.direction)) {
      errors.push(`${label}: From, To and Direction are required`)
    }
    if (isFilled(nb.from) && nb.from === nb.to) errors.push(`${label}: From and To must be different`)
    for (const n of new Set([newRefIndex(nb.from), newRefIndex(nb.to)])) {
      if (n !== null && !isFilled(rows[n]?.titleEn)) errors.push(`${label}: New ${n + 1} has no English title`)
    }
    if (isFilled(nb.from) && isFilled(nb.direction)) {
      const key = directionKey(nb.from, nb.direction)
      if (taken.has(key)) errors.push(`${label}: the From location already has a neighbor going ${String(nb.direction).trim()}`)
      taken.add(key)
    }
  })
  return errors
}

/**
 * Saves the whole form. Resolves { ok: true, created } or { ok: false, error, created, orphans },
 * as saveFastEvent does.
 */
export async function saveFastLocations({ storyUuid, story, form }) {
  const { created, create, createTextsAndCard, relabelLast } = await openFastSave(storyUuid, story)
  const newIds = new Map()

  try {
    for (const [index, row] of form.locations.entries()) {
      if (isLocationRowEmpty(row)) continue
      const t = await createTextsAndCard(row)
      const saved = await create('locations', compact({
        idCard: t.idCard,
        idTextName: t.idTitle,
        idTextDescription: t.idDesc,
        idTextNarrative: t.idDesc,
        costEnergyEnter: toNumber(row.energy),
      }), `Location ${index + 1}`)
      const idLocation = requireId(pickId(saved, ['id', 'idLocation']), 'location')
      relabelLast(`Location ${index + 1} #${idLocation}`)
      newIds.set(index, idLocation)
    }

    const resolve = (ref) => {
      const n = newRefIndex(ref)
      return n === null ? toNumber(ref) : requireId(newIds.get(n), `location ${n + 1}`)
    }
    // One row per edge: flagBack = 1 already lets the engine walk it backwards.
    for (const [index, nb] of form.neighbors.entries()) {
      await create('location-neighbors', compact({
        idLocationFrom: resolve(nb.from),
        idLocationTo: resolve(nb.to),
        direction: toText(nb.direction),
        conditionRegistryKey: toText(nb.conditionRegistryKey),
        conditionRegistryValue: toText(nb.conditionRegistryValue),
        registryValueOperatorCondition: toText(nb.registryValueOperatorCondition),
        energyCost: toNumber(nb.energyCost),
        costFood: toNumber(nb.costFood),
        costMagic: toNumber(nb.costMagic),
        costCoin: toNumber(nb.costCoin),
        flagBack: toNumber(nb.flagBack) === 1 ? 1 : 0,
      }), `Neighbor ${index + 1} (${toText(nb.direction)})`)
    }
    return { ok: true, created }
  } catch (err) {
    return failedSave(storyUuid, created, err)
  }
}

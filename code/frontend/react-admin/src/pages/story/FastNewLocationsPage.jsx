/**
 * FastNewLocationsPage — one form that creates many locations and the neighbors linking them.
 * Every location gets fresh texts and a card; the save logic lives in FastNewLocationsHelpers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getStory, listEntities } from '../../api/storyApi'
import { buildLocationOptions } from './StoryEditorPageHelpers'
import { setIn, SUMMARY_HIDE_MS } from './FastFormHelpers'
import {
  emptyFastLocationsForm, emptyLocationRow, emptyNeighborRow, buildEndpointOptions,
  removeLocationRow, validateFastLocations, saveFastLocations,
} from './FastNewLocationsHelpers'
import { TextField, SelectField, TextBlockFields, Section, SaveSummary, GRID3, GRID4 } from './FastFormFields'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ErrorAlert from '../../components/common/ErrorAlert'
import {
  LOCATION_NEIGHBOR_DIRECTION_OPTIONS, LOCATION_NEIGHBOR_FLAG_BACK_OPTIONS,
} from '../../constants/story/locationNeighbors'
import { CHOICE_CONDITION_OPERATOR_OPTIONS } from '../../constants/story/storyFieldOptions'

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback

function RemoveButton({ title, onClick }) {
  return (
    <button type="button" className="pg-btn pg-btn-danger pg-btn-sm" title={title} aria-label={title} onClick={onClick}>
      <i className="fas fa-trash" />
    </button>
  )
}

function AddButton({ label, onClick }) {
  return (
    <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm mb-3" onClick={onClick}>
      <i className="fas fa-plus me-1" />{label}
    </button>
  )
}

export default function FastNewLocationsPage() {
  const { uuid } = useParams()
  const navigate = useNavigate()

  const [story, setStory] = useState(null)
  const [texts, setTexts] = useState([])
  const [locations, setLocations] = useState([])
  const [neighbors, setNeighbors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyFastLocationsForm)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  // Texts, locations and neighbors feed the From/To options and the duplicate check.
  const loadLists = useCallback(() => Promise.all([
    listEntities(uuid, 'texts'),
    listEntities(uuid, 'locations'),
    listEntities(uuid, 'location-neighbors'),
  ]), [uuid])

  const applyLists = ([textsData, locationsData, neighborsData]) => {
    setTexts(textsData || [])
    setLocations(locationsData || [])
    setNeighbors(neighborsData || [])
  }

  useEffect(() => {
    let alive = true
    Promise.all([getStory(uuid), loadLists()])
      .then(([storyData, lists]) => {
        if (!alive) return
        setStory(storyData)
        applyLists(lists)
      })
      .catch(err => { if (alive) setError(errorMessage(err, 'Load failed')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [uuid, loadLists])

  useEffect(() => {
    if (!result?.ok) return undefined
    const timer = setTimeout(() => setResult(null), SUMMARY_HIDE_MS)
    return () => clearTimeout(timer)
  }, [result])

  const locationOptions = useMemo(() => buildLocationOptions(locations, texts), [locations, texts])
  const endpointOptions = useMemo(
    () => buildEndpointOptions(form.locations, locationOptions), [form.locations, locationOptions])

  const update = (path, value) => setForm(prev => setIn(prev, path, value))
  const addRow = (list, row) => setForm(prev => ({ ...prev, [list]: [...prev[list], row] }))

  const handleSave = async () => {
    setResult(null)
    const errors = validateFastLocations(form, neighbors)
    if (errors.length) {
      setError(errors.join(' — '))
      return
    }
    setError('')
    setSaving(true)
    try {
      const outcome = await saveFastLocations({ storyUuid: uuid, story, form })
      setResult(outcome)
      if (outcome.ok) {
        setForm(emptyFastLocationsForm())
        applyLists(await loadLists())
      }
    } catch (err) {
      setError(errorMessage(err, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading story…" />

  return (
    <div>
      <div className="flex items-center gap-3 mb-3" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={() => navigate(`/stories/${uuid}/edit`)}>
          <i className="fas fa-arrow-left me-1" /> Back
        </button>
        <h2 className="pg-page-title" style={{ margin: 0 }}>
          <i className="fas fa-map-marked-alt me-2" />
          Fast New Locations — {story?.author || uuid.slice(0, 8)}
        </h2>
        <button type="button" className="pg-btn pg-btn-gold" onClick={handleSave} disabled={saving} style={{ marginLeft: 'auto' }}>
          <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'} me-1`} />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      <SaveSummary result={result} onClose={() => setResult(null)} testId="fast-locations-summary" successText="Locations created" />

      {form.locations.map((row, i) => (
        <Section key={`location-${i}`} title={`New ${i + 1} — location (ignored when fully empty)`} icon="fa-map-marker-alt"
          headerExtra={<div className="ml-auto"><RemoveButton title={`Remove location ${i + 1}`}
            onClick={() => setForm(prev => removeLocationRow(prev, i))} /></div>}>
          <TextBlockFields idPrefix={`location-${i}`} block={row} onChange={(p, v) => update(['locations', i, ...p], v)} />
          <div className={`${GRID4} mt-2`}>
            <TextField id={`location-${i}-energy`} label="Energy Cost to Enter" type="number" value={row.energy}
              onChange={v => update(['locations', i, 'energy'], v)} />
          </div>
        </Section>
      ))}
      <AddButton label="Add location" onClick={() => addRow('locations', emptyLocationRow())} />

      {form.neighbors.map((nb, i) => (
        <Section key={`neighbor-${i}`} title={`Neighbor ${i + 1}`} icon="fa-project-diagram"
          headerExtra={<div className="ml-auto"><RemoveButton title={`Remove neighbor ${i + 1}`}
            onClick={() => setForm(prev => ({ ...prev, neighbors: prev.neighbors.filter((_, j) => j !== i) }))} /></div>}>
          <div className={GRID4}>
            <SelectField id={`neighbor-${i}-from`} label="From" value={nb.from} options={endpointOptions}
              onChange={v => update(['neighbors', i, 'from'], v)} />
            <SelectField id={`neighbor-${i}-to`} label="To" value={nb.to} options={endpointOptions}
              onChange={v => update(['neighbors', i, 'to'], v)} />
            <SelectField id={`neighbor-${i}-direction`} label="Direction" value={nb.direction}
              options={LOCATION_NEIGHBOR_DIRECTION_OPTIONS} onChange={v => update(['neighbors', i, 'direction'], v)} />
            <SelectField id={`neighbor-${i}-flagBack`} label="Way Back (flag back)" value={nb.flagBack} placeholder={null}
              options={LOCATION_NEIGHBOR_FLAG_BACK_OPTIONS} onChange={v => update(['neighbors', i, 'flagBack'], v)} />
          </div>
          <div className={`${GRID3} mt-2`}>
            <TextField id={`neighbor-${i}-key`} label="Registry Key (condition)" value={nb.conditionRegistryKey}
              onChange={v => update(['neighbors', i, 'conditionRegistryKey'], v)} />
            <TextField id={`neighbor-${i}-keyValue`} label="Registry Value (condition)" value={nb.conditionRegistryValue}
              onChange={v => update(['neighbors', i, 'conditionRegistryValue'], v)} />
            <SelectField id={`neighbor-${i}-keyOperator`} label="Registry Operator (condition)"
              value={nb.registryValueOperatorCondition} options={CHOICE_CONDITION_OPERATOR_OPTIONS}
              onChange={v => update(['neighbors', i, 'registryValueOperatorCondition'], v)} />
          </div>
          <div className={`${GRID4} mt-2`}>
            {[['energyCost', 'Energy Cost'], ['costFood', 'Food'], ['costMagic', 'Magic'], ['costCoin', 'Coin']].map(([key, label]) => (
              <TextField key={key} id={`neighbor-${i}-${key}`} label={label} type="number" value={nb[key]}
                onChange={v => update(['neighbors', i, key], v)} />
            ))}
          </div>
        </Section>
      ))}
      <AddButton label="Add neighbor" onClick={() => addRow('neighbors', emptyNeighborRow())} />
    </div>
  )
}

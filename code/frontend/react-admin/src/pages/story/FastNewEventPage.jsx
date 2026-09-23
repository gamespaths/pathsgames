/**
 * FastNewEventPage — one form that creates an event with its effect or up to five choices.
 * Every element gets fresh texts and a card; the save logic lives in FastNewEventHelpers.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getStory, listEntities } from '../../api/storyApi'
import { buildKeysOptions, buildLocationOptions, getOptionDisplay } from './StoryEditorPageHelpers'
import {
  emptyFastEventForm, setIn, validateFastEvent, saveFastEvent, MODE_EFFECT, MODE_CHOICE, SUMMARY_HIDE_MS,
} from './FastNewEventHelpers'
import PathsSelector from '../../components/common/story/PathsSelector'
import PathsOptionsSelectorModal from '../../components/common/story/PathsOptionsSelectorModal'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ErrorAlert from '../../components/common/ErrorAlert'
import {
  EVENT_TYPE_OPTIONS, EVENT_EFFECT_TARGET_OPTIONS, EVENT_EFFECT_STATISTICS_OPTIONS,
  CHOICE_CONDITION_TYPE_OPTIONS, CHOICE_CONDITION_OPERATOR_OPTIONS,
} from '../../constants/story/storyFieldOptions'
import { TEXT_MAX_LENGTH } from '../../constants/story/textLimits'

const INPUT_STYLE = { fontSize: '0.8rem', padding: '4px 8px', width: '100%', minWidth: 0, boxSizing: 'border-box' }
const LABEL_STYLE = { fontSize: '0.75rem', marginBottom: 3 }
// Literal class names: Tailwind only generates what it finds spelled out in the source.
const GRID2 = 'grid grid-cols-1 md:grid-cols-2 gap-2'
const GRID3 = 'grid grid-cols-1 md:grid-cols-3 gap-2'
const GRID4 = 'grid grid-cols-1 md:grid-cols-4 gap-2'

function TextField({ id, label, value, onChange, type = 'text', maxLength }) {
  return (
    <div>
      <label htmlFor={id} className="pg-label" style={LABEL_STYLE}>{label}</label>
      <input
        id={id}
        type={type}
        className="pg-input"
        style={INPUT_STYLE}
        value={value}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function SelectField({ id, label, value, options, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="pg-label" style={LABEL_STYLE}>{label}</label>
      <select id={id} className="pg-input" style={INPUT_STYLE} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Select...</option>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  )
}

function TextAreaField({ id, label, value, onChange, className }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label htmlFor={id} className="pg-label" style={LABEL_STYLE}>{label}</label>
      <textarea
        id={id}
        className="pg-textarea flex-1"
        rows={3}
        style={INPUT_STYLE}
        value={value}
        maxLength={TEXT_MAX_LENGTH}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

// Title, description, copyright, link and image of one element (event, effect, choice…).
// Titles stacked in the first column, each description a textarea spanning both rows.
function TextBlockFields({ idPrefix, block, onChange }) {
  const text = (key, label, className) => (
    <div className={className}>
      <TextField id={`${idPrefix}-${key}`} label={label} value={block[key]} maxLength={TEXT_MAX_LENGTH}
        onChange={v => onChange([key], v)} />
    </div>
  )
  const area = (key, label, className) => (
    <TextAreaField id={`${idPrefix}-${key}`} label={label} value={block[key]} className={className}
      onChange={v => onChange([key], v)} />
  )
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {text('titleEn', 'Title (EN)', 'md:col-start-1 md:row-start-1')}
        {text('titleIt', 'Title (IT)', 'md:col-start-1 md:row-start-2')}
        {area('descEn', 'Description (EN)', 'md:col-start-2 md:row-start-1 md:row-span-2')}
        {area('descIt', 'Description (IT)', 'md:col-start-3 md:row-start-1 md:row-span-2')}
      </div>
      <div className={`${GRID3} mt-2`}>
        {text('copyright', 'Copyright Text')}
        <TextField id={`${idPrefix}-link`} label="Copyright Link" value={block.link} onChange={v => onChange(['link'], v)} />
        <TextField id={`${idPrefix}-urlImage`} label="Image URL" value={block.urlImage} onChange={v => onChange(['urlImage'], v)} />
      </div>
    </>
  )
}

function Section({ title, icon, headerExtra, children }) {
  return (
    <div className="pg-card mb-3" style={{ padding: '0.75rem' }}>
      <div className="flex items-center gap-4" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        <h3 className="pg-label" style={{ fontSize: '0.9rem', margin: 0 }}>
          <i className={`fas ${icon} me-2`} />{title}
        </h3>
        {headerExtra}
      </div>
      {children}
    </div>
  )
}

function CloseButton({ onClose }) {
  return (
    <button type="button" onClick={onClose} className="ml-auto opacity-60 hover:opacity-100" title="Close report" aria-label="Close report">
      <i className="fas fa-times" />
    </button>
  )
}

function SaveSummary({ result, onClose }) {
  if (!result) return null
  if (result.ok) {
    return (
      <div className="pg-alert pg-alert-success mb-3" data-testid="fast-event-summary">
        <i className="fas fa-check-circle mt-0.5" />
        <div>
          Event created — {result.created.length} entities written:
          <ul className="mt-1" style={{ fontSize: '0.8rem' }}>
            {result.created.map((c, i) => <li key={`${c.uuid}-${i}`}>{c.entityType}: {c.label}</li>)}
          </ul>
        </div>
        <CloseButton onClose={onClose} />
      </div>
    )
  }
  return (
    <div className="pg-alert pg-alert-danger mb-3" data-testid="fast-event-summary">
      <i className="fas fa-exclamation-triangle mt-0.5" />
      <div>
        Save failed: {result.error}.
        {' '}Rolled back {result.created.length - result.orphans.length} of {result.created.length} entities.
        {result.orphans.length > 0 && (
          <>
            <div className="mt-1">Left orphaned (delete them by hand):</div>
            <ul style={{ fontSize: '0.8rem' }}>
              {result.orphans.map((o, i) => <li key={`${o.uuid}-${i}`}>{o.entityType}: {o.label}{o.uuid ? ` (${o.uuid})` : ''}</li>)}
            </ul>
          </>
        )}
      </div>
      <CloseButton onClose={onClose} />
    </div>
  )
}

export default function FastNewEventPage() {
  const { uuid } = useParams()
  const navigate = useNavigate()

  const [story, setStory] = useState(null)
  const [texts, setTexts] = useState([])
  const [locations, setLocations] = useState([])
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyFastEventForm)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  // { path, title, options } | null — the reference picker currently open
  const [selector, setSelector] = useState(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      getStory(uuid),
      listEntities(uuid, 'texts'),
      listEntities(uuid, 'locations'),
      listEntities(uuid, 'keys'),
    ])
      .then(([storyData, textsData, locationsData, keysData]) => {
        if (!alive) return
        setStory(storyData)
        setTexts(textsData || [])
        setLocations(locationsData || [])
        setKeys(keysData || [])
      })
      .catch(err => { if (alive) setError(err?.response?.data?.message || err?.message || 'Load failed') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [uuid])

  useEffect(() => {
    if (!result?.ok) return undefined
    const timer = setTimeout(() => setResult(null), SUMMARY_HIDE_MS)
    return () => clearTimeout(timer)
  }, [result])

  const locationOptions = useMemo(() => buildLocationOptions(locations, texts), [locations, texts])
  const keysOptions = useMemo(() => buildKeysOptions(keys), [keys])

  const update = (path, value) => setForm(prev => setIn(prev, path, value))
  const valueAt = (path) => path.reduce((acc, k) => acc?.[k], form)

  // Location / registry-key picker: existing values only, no "New" shortcut.
  const refSelector = (id, label, path, options) => (
    <PathsSelector
      label={label}
      name={id}
      value={valueAt(path)}
      displayValue={getOptionDisplay(options, valueAt(path))}
      onOpenSelector={() => setSelector({ path, title: `Select ${label}`, options })}
      onClear={() => update(path, '')}
      showNewButton={false}
    />
  )

  const handleSave = async () => {
    setResult(null)
    const errors = validateFastEvent(form)
    if (errors.length) {
      setError(errors.join(' — '))
      return
    }
    setError('')
    setSaving(true)
    try {
      const outcome = await saveFastEvent({ storyUuid: uuid, story, form })
      setResult(outcome)
      if (outcome.ok) setForm(emptyFastEventForm())
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Save failed')
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
          <i className="fas fa-bolt me-2" />
          Fast New Event — {story?.author || uuid.slice(0, 8)}
        </h2>
        <button type="button" className="pg-btn pg-btn-gold" onClick={handleSave} disabled={saving} style={{ marginLeft: 'auto' }}>
          <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'} me-1`} />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      <SaveSummary result={result} onClose={() => setResult(null)} />

      <Section title="Event" icon="fa-bolt" headerExtra={(
        <div className="flex gap-4" role="radiogroup" aria-label="Event outcome">
          {[[MODE_EFFECT, 'With effect'], [MODE_CHOICE, 'With choices']].map(([mode, label]) => (
            <label key={mode} className="flex items-center gap-1" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="radio" name="fast-event-mode" value={mode} checked={form.mode === mode}
                onChange={() => update(['mode'], mode)} />
              {label}
            </label>
          ))}
        </div>
      )}>
        <TextBlockFields idPrefix="event" block={form} onChange={update} />
        <div className={`${GRID3} mt-2`}>
          {refSelector('event-location', 'Location', ['idSpecificLocation'], locationOptions)}
          <TextField id="event-costEnery" label="Energy Cost" type="number" value={form.costEnery}
            onChange={v => update(['costEnery'], v)} />
          <SelectField id="event-type" label="Event Type" value={form.type} options={EVENT_TYPE_OPTIONS}
            onChange={v => update(['type'], v)} />
        </div>
        <div className={`${GRID3} mt-2`}>
          {refSelector('event-key', 'Registry Key (condition)', ['registryKeyCondition'], keysOptions)}
          <TextField id="event-keyValue" label="Registry Value (condition)" value={form.registryValueCondition}
            onChange={v => update(['registryValueCondition'], v)} />
          <SelectField id="event-keyOperator" label="Registry Operator (condition)" value={form.registryValueOperatorCondition}
            options={CHOICE_CONDITION_OPERATOR_OPTIONS} onChange={v => update(['registryValueOperatorCondition'], v)} />
        </div>
      </Section>

      {form.mode === MODE_EFFECT ? (
        <Section title="Effect" icon="fa-magic">
          <TextBlockFields idPrefix="effect" block={form.effect} onChange={(p, v) => update(['effect', ...p], v)} />
          <div className={`${GRID3} mt-2`}>
            <SelectField id="effect-statistics" label="Statistic" value={form.effect.statistics}
              options={EVENT_EFFECT_STATISTICS_OPTIONS} onChange={v => update(['effect', 'statistics'], v)} />
            <TextField id="effect-value" label="Value" type="number" value={form.effect.value}
              onChange={v => update(['effect', 'value'], v)} />
            <SelectField id="effect-target" label="Target" value={form.effect.target}
              options={EVENT_EFFECT_TARGET_OPTIONS} onChange={v => update(['effect', 'target'], v)} />
          </div>
          <div className={`${GRID3} mt-2`}>
            {refSelector('effect-key', 'Registry Key to Write', ['effect', 'keyToAdd'], keysOptions)}
            <TextField id="effect-keyValue" label="Registry Value to Write" value={form.effect.keyValueToAdd}
              onChange={v => update(['effect', 'keyValueToAdd'], v)} />
            {refSelector('effect-location', 'Move To Location', ['effect', 'idLocation'], locationOptions)}
          </div>
        </Section>
      ) : (
        form.choices.map((choice, i) => (
          <Section key={i} title={`Choice ${i + 1} (ignored when the English title is empty)`} icon="fa-code-branch">
            <div className={GRID4}>
              <TextField id={`choice-${i}-priority`} label="Priority" type="number" value={choice.priority}
                onChange={v => update(['choices', i, 'priority'], v)} />
            </div>
            <div className="mt-2">
              <TextBlockFields idPrefix={`choice-${i}`} block={choice} onChange={(p, v) => update(['choices', i, ...p], v)} />
            </div>
            <h4 className="pg-label mt-3" style={{ fontSize: '0.8rem' }}>Condition (ignored without type and key)</h4>
            <div className={GRID4}>
              <SelectField id={`choice-${i}-cond-type`} label="Type" value={choice.condition.type}
                options={CHOICE_CONDITION_TYPE_OPTIONS} onChange={v => update(['choices', i, 'condition', 'type'], v)} />
              {refSelector(`choice-${i}-cond-key`, 'Condition Key', ['choices', i, 'condition', 'key'], keysOptions)}
              <TextField id={`choice-${i}-cond-value`} label="Condition Value" value={choice.condition.value}
                onChange={v => update(['choices', i, 'condition', 'value'], v)} />
              <SelectField id={`choice-${i}-cond-operator`} label="Operator" value={choice.condition.operator}
                options={CHOICE_CONDITION_OPERATOR_OPTIONS} onChange={v => update(['choices', i, 'condition', 'operator'], v)} />
            </div>
            <h4 className="pg-label mt-3" style={{ fontSize: '0.8rem' }}>Effect (ignored when the English title is empty)</h4>
            <TextBlockFields idPrefix={`choice-${i}-effect`} block={choice.effect}
              onChange={(p, v) => update(['choices', i, 'effect', ...p], v)} />
            <div className={`${GRID4} mt-2`}>
              <SelectField id={`choice-${i}-effect-statistics`} label="Statistic" value={choice.effect.statistics}
                options={EVENT_EFFECT_STATISTICS_OPTIONS} onChange={v => update(['choices', i, 'effect', 'statistics'], v)} />
              <TextField id={`choice-${i}-effect-value`} label="Value" type="number" value={choice.effect.value}
                onChange={v => update(['choices', i, 'effect', 'value'], v)} />
              {refSelector(`choice-${i}-effect-key`, 'Registry Key', ['choices', i, 'effect', 'key'], keysOptions)}
              {refSelector(`choice-${i}-effect-location`, 'Move To Location', ['choices', i, 'effect', 'idLocation'], locationOptions)}
            </div>
            <div className={`${GRID2} mt-2`}>
              <TextField id={`choice-${i}-effect-valueToAdd`} label="Registry Value to Write" value={choice.effect.valueToAdd}
                onChange={v => update(['choices', i, 'effect', 'valueToAdd'], v)} />
              <TextField id={`choice-${i}-effect-valueToRemove`} label="Registry Value to Clear (must match)"
                value={choice.effect.valueToRemove} onChange={v => update(['choices', i, 'effect', 'valueToRemove'], v)} />
            </div>
          </Section>
        ))
      )}

      <PathsOptionsSelectorModal
        open={!!selector}
        onClose={() => setSelector(null)}
        onSelect={value => update(selector.path, value)}
        selectedValue={selector ? valueAt(selector.path) : ''}
        title={selector?.title}
        options={selector?.options || []}
      />
    </div>
  )
}

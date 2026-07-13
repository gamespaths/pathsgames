import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getStory, listEntities, updateEntity, createEntity, deleteEntity } from '../../api/storyApi'
import { makeReferenceOptions } from './StoryEditorPageHelpers'
import FastTextSelectorModal from '../../components/common/story/FastTextSelectorModal'
import FastTextCreatorModal from '../../components/common/story/FastTextCreatorModal'
import PathsOptionsSelectorModal from '../../components/common/story/PathsOptionsSelectorModal'
import EntityForm from '../../components/common/story/EntityForm'
import ConfirmModal from '../../components/common/ConfirmModal'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ErrorAlert from '../../components/common/ErrorAlert'
import { STORIES_ENTITIES_FIELDS as FIELDS } from '../../constants/story/storiesEntities'

// ─── Entity types loaded to detect unused cards ──────────────────────────────
const CARD_REF_TYPES = [
  'difficulties', 'locations', 'location-neighbors', 'events', 'items',
  'character-templates', 'classes', 'traits', 'creators', 'keys',
  'choices', 'choice-effects', 'weather-rules', 'global-random-events', 'missions',
]

// ─── Desc-Text alignment ─────────────────────────────────────────────────────
// These entity types carry BOTH `idCard` and `idTextDescription`.
// When a card's idTextDescription differs from the value stored on the linked
// entity (matched by idCard), we show a blue alert icon in the Desc Text cell.
// Clicking it calls handleAlignDescText which patches only `idTextDescription`
// on every misaligned entity, leaving all other fields untouched.
// Entity types NOT in this list but with a potential idCard+idTextDescription
// mismatch are reported as warnings rather than silently updated.
const DESC_ALIGN_TYPES = [
  'difficulties', 'locations', 'events', 'items',
  'character-templates', 'classes', 'traits', 'keys', 'missions',
]
// ─────────────────────────────────────────────────────────────────────────────

const CELL = { padding: '0.22rem 0.4rem', fontSize: '0.78rem' }
const INPUT_STYLE = {
  background: 'rgba(0,0,0,0.35)',
  border: '1px solid rgba(200,150,10,0.3)',
  borderRadius: 3,
  color: 'var(--color-parchment)',
  fontSize: '0.73rem',
  padding: '0.2rem 0.35rem',
  width: '100%',
  minWidth: 120,
  fontFamily: 'Crimson Text, Georgia, serif',
  outline: 'none',
}

// Prettify an entity-type slug into a short readable label, e.g.
// "character-templates" → "Character Templates".
const prettyEntityType = (type) =>
  type
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

function LinkFieldCell({ value, onChange, ariaLabel }) {
  const href = value && value.trim() ? value.trim() : ''
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, width: '100%' }}>
      <input
        style={{ ...INPUT_STYLE, minWidth: 60 }}
        value={value ?? ''}
        onChange={onChange}
        placeholder="https://…"
        aria-label={ariaLabel}
      />
      <a
        href={href || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="pg-btn pg-btn-ghost pg-btn-sm"
        style={{
          padding: '0.2rem 0.35rem', fontSize: '0.68rem', flexShrink: 0,
          ...(href ? {} : { pointerEvents: 'none', opacity: 0.3 }),
        }}
        title={href ? 'Open link in new tab' : 'No link'}
        onClick={href ? undefined : (e) => e.preventDefault()}
        aria-label={`Open ${ariaLabel}`}
      >
        <i className="fas fa-external-link-alt" />
      </a>
    </span>
  )
}

function TextFieldCell({ value, textShort, onOpenSelector, onOpenCreator, onAlert, onAlignAlert, onCreateNew, maxWidth = 140 }) {
  const label = value ? `#${value}${textShort}` : '—'
  const onClick = value ? onOpenCreator : onOpenSelector
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <button
        type="button"
        className="pg-btn pg-btn-ghost pg-btn-sm"
        style={{ fontSize: '0.7rem', maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        onClick={onClick}
        title={label}
      >
        {label}
      </button>
      {onCreateNew && (
        <button
          type="button"
          className="pg-btn pg-btn-sm"
          style={{ padding: '0.1rem 0.3rem', fontSize: '0.62rem', color: 'var(--color-gold-light)', background: 'transparent', border: '1px solid var(--color-gold-dark)', borderRadius: 3, flexShrink: 0 }}
          onClick={onCreateNew}
          title="Create a new text and use it as this Copyright Text"
        >
          <i className="fas fa-plus" />
        </button>
      )}
      {onAlert && (
        <button
          type="button"
          className="pg-btn pg-btn-sm"
          style={{ padding: '0.1rem 0.25rem', fontSize: '0.6rem', color: 'var(--color-ember)', background: 'transparent', border: '1px solid var(--color-ember)', borderRadius: 3, flexShrink: 0 }}
          onClick={onAlert}
          title="Same ID as Title Text — click to create a separate Desc Text"
        >
          <i className="fas fa-exclamation-triangle" />
        </button>
      )}
      {onAlignAlert && (
        <button
          type="button"
          className="pg-btn pg-btn-sm"
          style={{ padding: '0.1rem 0.25rem', fontSize: '0.6rem', color: '#4a9eff', background: 'transparent', border: '1px solid #4a9eff', borderRadius: 3, flexShrink: 0 }}
          onClick={onAlignAlert}
          title="idTextDescription diverso tra card ed entità — clicca per allineare"
        >
          <i className="fas fa-info-circle" />
        </button>
      )}
    </span>
  )
}

export default function CardsFastEditPage() {
  const { uuid } = useParams()
  const navigate = useNavigate()

  const [story, setStory]           = useState(null)
  const [rows, setRows]             = useState([])
  const [origRows, setOrigRows]     = useState([])
  const [texts, setTexts]           = useState([])
  const [creators, setCreators]     = useState([])
  const [refEntitiesByType, setRefEntitiesByType] = useState({})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [saving, setSaving]         = useState(new Set())
  const [savingAll, setSavingAll]   = useState(false)
  const [storyOptions, setStoryOptions] = useState([])

  // { cardUuid, field, startMode } | null  — FastTextSelectorModal (empty field)
  const [activeTextSel, setActiveTextSel] = useState(null)
  // { cardUuid, field } | null  — FastTextCreatorModal (existing text id)
  const [activeTextCreator, setActiveTextCreator] = useState(null)
  // { cardUuid } | null
  const [activeCreatorSel, setActiveCreatorSel] = useState(null)
  // entity | null  — EntityForm full-card modal
  const [cardModal, setCardModal] = useState(null)
  // { cardUuid, idCard } | null  — delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  // { cardUuid } | null  — create new separate desc text
  const [splitDescCreator, setSplitDescCreator] = useState(null)
  // { cardUuid } | null  — create a new text to replace the Copyright Text
  const [copyrightCreator, setCopyrightCreator] = useState(null)
  const [filter, setFilter] = useState('')
  // '' = tutti | '__none__' = non collegate | <entity-type>
  const [entityFilter, setEntityFilter] = useState('')

  const creatorsOptions = useMemo(() => makeReferenceOptions({
    entities: creators,
    idKeys: ['idCreator', 'id', 'id_creator'],
    textIdKeys: ['idText', 'idTextName'],
    texts,
  }), [creators, texts])

  const getTextShort = (idText, maxLen = 22) => {
    if (!idText) return ''
    const found = texts.find(t => Number(t.idText) === Number(idText) && t.lang === 'en')
    return found?.shortText ? ` ${found.shortText.slice(0, maxLen)}` : ''
  }

  const getTextValues = (idText) => {
    const en = texts.find(t => Number(t.idText) === Number(idText) && t.lang === 'en')
    const it = texts.find(t => Number(t.idText) === Number(idText) && t.lang === 'it')
    return {
      en: { shortText: en?.shortText || '', longText: en?.longText || '' },
      it: { shortText: it?.shortText || '', longText: it?.longText || '' },
    }
  }

  /** Returns the distinct entity types referencing this card via idCard
   *  (plus 'story' when the story itself points at the card). A card used as a
   *  location-neighbor return card (idCardBack) also counts as a reference, so
   *  it is treated like any other location-neighbors link. */
  const getCardEntityTypes = (idCard) => {
    const types = []
    if (story?.idCard != null && Number(story.idCard) === Number(idCard)) types.push('story')
    CARD_REF_TYPES.forEach(type => {
      const list = refEntitiesByType[type] || []
      if (list.some(e => e.idCard != null && Number(e.idCard) === Number(idCard))) types.push(type)
    })
    // location-neighbors also reference a card through idCardBack (return card);
    // include the type even when only idCardBack matches, avoiding duplicates.
    if (!types.includes('location-neighbors')) {
      const neighbors = refEntitiesByType['location-neighbors'] || []
      if (neighbors.some(e => e.idCardBack != null && Number(e.idCardBack) === Number(idCard))) {
        types.push('location-neighbors')
      }
    }
    return types
  }

  const getCreatorLabel = (idCreator) => {
    if (!idCreator) return '—'
    const opt = creatorsOptions.find(o => Number(o.value) === Number(idCreator))
    return opt ? opt.label.slice(0, 22) : `#${idCreator}`
  }

  const toRows = (cards) =>
    [...cards]
      .sort((a, b) => (Number(a.idCard ?? a.id) || 0) - (Number(b.idCard ?? b.id) || 0))
      .map(c => ({
        uuid: c.uuid,
        idCard: c.idCard ?? c.id,
        idTextTitle: c.idTextTitle ?? '',
        idTextDescription: c.idTextDescription ?? '',
        idTextCopyright: c.idTextCopyright ?? '',
        linkCopyright: c.linkCopyright ?? '',
        urlImage: c.urlImage ?? '',
        idCreator: c.idCreator ?? '',
        _orig: c,
      }))

  const load = async () => {
    try {
      const [storyData, cardsData, textsData, creatorsData, ...refLists] = await Promise.all([
        getStory(uuid),
        listEntities(uuid, 'cards'),
        listEntities(uuid, 'texts'),
        listEntities(uuid, 'creators'),
        ...CARD_REF_TYPES.map(t => listEntities(uuid, t)),
      ])
      setStory(storyData)
      setStoryOptions([{ value: storyData.uuid, label: `${storyData.author || 'Story'} (${storyData.uuid.slice(0, 8)})` }])
      setTexts(textsData)
      setCreators(creatorsData)

      const byType = {}
      CARD_REF_TYPES.forEach((type, i) => { byType[type] = refLists[i] })
      setRefEntitiesByType(byType)

      const r = toRows(cardsData)
      setRows(r)
      setOrigRows(JSON.parse(JSON.stringify(r)))
      setLoading(false)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [uuid])

  const updateRow = (cardUuid, field, value) =>
    setRows(prev => prev.map(r => r.uuid === cardUuid ? { ...r, [field]: value } : r))

  const isDirty = (row) => {
    const orig = origRows.find(r => r.uuid === row.uuid)
    if (!orig) return true
    return ['idTextTitle', 'idTextDescription', 'idTextCopyright', 'linkCopyright', 'urlImage', 'idCreator']
      .some(f => String(row[f] ?? '') !== String(orig[f] ?? ''))
  }

  const doSave = async (row) => {
    const payload = {
      ...row._orig,
      idTextTitle:       row.idTextTitle       ? Number(row.idTextTitle)       : null,
      idTextDescription: row.idTextDescription ? Number(row.idTextDescription) : null,
      idTextCopyright:   row.idTextCopyright   ? Number(row.idTextCopyright)   : null,
      linkCopyright:     row.linkCopyright  || null,
      urlImage:          row.urlImage       || null,
      idCreator:         row.idCreator      ? Number(row.idCreator)      : null,
    }
    await updateEntity(uuid, 'cards', row.uuid, payload)
    setOrigRows(prev => prev.map(r => r.uuid === row.uuid ? JSON.parse(JSON.stringify(row)) : r))
  }

  const saveRow = async (row) => {
    setSaving(prev => new Set([...prev, row.uuid]))
    try {
      await doSave(row)
      setSuccess(`Card #${row.idCard} saved`)
      setTimeout(() => setSuccess(''), 2000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(row.uuid); return s })
    }
  }

  const saveAll = async () => {
    const dirty = rows.filter(isDirty)
    if (!dirty.length) {
      setSuccess('Nothing to save')
      setTimeout(() => setSuccess(''), 2000)
      return
    }
    setSavingAll(true)
    let saved = 0; let failed = 0
    for (const row of dirty) {
      setSaving(prev => new Set([...prev, row.uuid]))
      try {
        await doSave(row)
        saved++
      } catch (e) {
        failed++
        setError(e.message)
      } finally {
        setSaving(prev => { const s = new Set(prev); s.delete(row.uuid); return s })
      }
    }
    setSavingAll(false)
    setSuccess(`Saved ${saved} card${saved !== 1 ? 's' : ''}${failed ? `, ${failed} error${failed !== 1 ? 's' : ''}` : ''}`)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleSaveFastText = async ({ uuidStory, idText, translations, mode }) => {
    const targetUuid = uuidStory || uuid
    const existingTexts = await listEntities(targetUuid, 'texts')
    const creatorsData  = await listEntities(targetUuid, 'creators')
    const firstCreator  = creatorsData.find(c => c?.idCreator !== null && c?.idCreator !== undefined)
    const firstCreatorId = firstCreator?.idCreator
    const storyCreatorId      = Number(story?.idCreator)
    const storyCopyrightTextId = Number(story?.idTextCopyright)

    let finalIdText = Number(idText)
    if (mode === 'input-generator') {
      const ids = existingTexts.map(t => Number(t.idText)).filter(v => !Number.isNaN(v))
      finalIdText = ids.length ? Math.max(...ids) + 1 : 1
    }

    const langs = mode === 'input-generator' ? ['en'] : ['en', 'it']
    for (const lang of langs) {
      const tr = translations?.[lang] || { shortText: '', longText: '' }
      const existing = existingTexts.find(
        t => Number(t.idText) === Number(finalIdText) && t.lang === lang
      )
      if (existing?.uuid) {
        await updateEntity(targetUuid, 'texts', existing.uuid, {
          ...existing,
          id: Number(finalIdText), idText: Number(finalIdText),
          lang, shortText: tr.shortText || '', longText: tr.longText || '',
          idTextCopyright: Number.isFinite(storyCopyrightTextId) ? storyCopyrightTextId : (existing?.idTextCopyright ?? null),
          idCreator: Number.isFinite(storyCreatorId) ? storyCreatorId : (existing?.idCreator ?? firstCreatorId),
        })
      } else {
        await createEntity(targetUuid, 'texts', {
          id: Number(finalIdText), idText: Number(finalIdText),
          lang, shortText: tr.shortText || '', longText: tr.longText || '',
          idTextCopyright: Number.isFinite(storyCopyrightTextId) ? storyCopyrightTextId : null,
          idCreator: Number.isFinite(storyCreatorId) ? storyCreatorId : firstCreatorId,
        })
      }
    }

    const refreshed = await listEntities(uuid, 'texts')
    setTexts(refreshed)
    setSuccess(`Text #${finalIdText} saved`)
    setTimeout(() => setSuccess(''), 2000)
    return { idText: Number(finalIdText), uuidStory: targetUuid }
  }

  const handleDeleteCard = async () => {
    const { cardUuid, idCard } = deleteConfirm
    setDeleteConfirm(null)
    try {
      await deleteEntity(uuid, 'cards', cardUuid)
      setRows(prev => prev.filter(r => r.uuid !== cardUuid))
      setOrigRows(prev => prev.filter(r => r.uuid !== cardUuid))
      setSuccess(`Card #${idCard} deleted`)
      setTimeout(() => setSuccess(''), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  // ─── Desc-Text alignment helpers ─────────────────────────────────────────
  /** Returns [{type, entity}] for all entities referencing this card whose
   *  idTextDescription differs from the card's current idTextDescription. */
  const getMisalignedEntities = (row) => {
    if (!row.idTextDescription) return []
    return DESC_ALIGN_TYPES.flatMap(type => {
      const list = refEntitiesByType[type] || []
      return list
        .filter(e =>
          Number(e.idCard) === Number(row.idCard) &&
          e.idTextDescription != null &&
          Number(e.idTextDescription) !== Number(row.idTextDescription)
        )
        .map(e => ({ type, entity: e }))
    })
  }

  /** Aligns idTextDescription on every misaligned entity.
   *  Types outside DESC_ALIGN_TYPES that somehow have a mismatch are reported
   *  as warnings rather than silently patched. */
  const handleAlignDescText = async (row) => {
    const misaligned = getMisalignedEntities(row)
    if (!misaligned.length) return

    // Warn for unexpected types not covered by DESC_ALIGN_TYPES
    const unsupportedTypes = [...new Set(
      Object.entries(refEntitiesByType)
        .filter(([type]) => !DESC_ALIGN_TYPES.includes(type))
        .flatMap(([type, list]) =>
          list.some(e =>
            Number(e.idCard) === Number(row.idCard) &&
            e.idTextDescription != null &&
            Number(e.idTextDescription) !== Number(row.idTextDescription)
          ) ? [type] : []
        )
    )]
    if (unsupportedTypes.length) {
      setError(`Attenzione: idTextDescription non allineato in entità non gestite: ${unsupportedTypes.join(', ')}`)
    }

    for (const { type, entity } of misaligned) {
      await updateEntity(uuid, type, entity.uuid, {
        ...entity,
        idTextDescription: Number(row.idTextDescription),
      })
      setRefEntitiesByType(prev => ({
        ...prev,
        [type]: prev[type].map(e =>
          e.uuid === entity.uuid
            ? { ...e, idTextDescription: Number(row.idTextDescription) }
            : e
        ),
      }))
    }
    setSuccess(`Allineate ${misaligned.length} entit${misaligned.length === 1 ? 'à' : 'às'}`)
    setTimeout(() => setSuccess(''), 2500)
  }
  // ─────────────────────────────────────────────────────────────────────────

  const handleSaveCardModal = async (data) => {
    try {
      await updateEntity(uuid, 'cards', cardModal.uuid, data)
      setCardModal(null)
      const refreshed = await listEntities(uuid, 'cards')
      const r = toRows(refreshed)
      setRows(r)
      setOrigRows(JSON.parse(JSON.stringify(r)))
      setSuccess('Card saved')
      setTimeout(() => setSuccess(''), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <LoadingSpinner text="Loading cards…" />

  // Entity types actually present among the loaded cards (for the dropdown).
  const presentEntityTypes = [...new Set(
    rows.flatMap(r => getCardEntityTypes(r.idCard))
  )].sort((a, b) => a.localeCompare(b))

  const matchesEntityFilter = (row) => {
    if (!entityFilter) return true
    const types = getCardEntityTypes(row.idCard)
    if (entityFilter === '__none__') return types.length === 0
    return types.includes(entityFilter)
  }

  const filteredRows      = rows
    .filter(matchesEntityFilter)
    .filter(r => {
      if (!filter) return true
      const f = filter.toLowerCase()
      return (
        String(r.idCard).includes(f) ||
        getTextShort(r.idTextTitle).toLowerCase().includes(f) ||
        getTextShort(r.idTextDescription).toLowerCase().includes(f) ||
        getTextShort(r.idTextCopyright).toLowerCase().includes(f) ||
        (r.linkCopyright || '').toLowerCase().includes(f) ||
        (r.urlImage || '').toLowerCase().includes(f)
      )
    })

  const nextTextId = texts.length
    ? Math.max(...texts.map(t => Number(t.idText)).filter(v => Number.isFinite(v))) + 1
    : 1

  const splitDescRow      = splitDescCreator  ? rows.find(r => r.uuid === splitDescCreator.cardUuid) : null
  const copyrightRow      = copyrightCreator  ? rows.find(r => r.uuid === copyrightCreator.cardUuid) : null
  const activeRow         = activeTextSel     ? rows.find(r => r.uuid === activeTextSel.cardUuid)     : null
  const activeCreatorRow  = activeCreatorSel   ? rows.find(r => r.uuid === activeCreatorSel.cardUuid)  : null
  const activeCreatorRowT = activeTextCreator  ? rows.find(r => r.uuid === activeTextCreator.cardUuid) : null
  const dirtyCount        = rows.filter(isDirty).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="pg-btn pg-btn-ghost pg-btn-sm"
          onClick={() => navigate(`/stories/${uuid}/edit`)}
        >
          <i className="fas fa-arrow-left me-1" /> Back
        </button>
        <h2 className="pg-page-title" style={{ margin: 0 }}>
          <i className="fas fa-id-card me-2" />
          Cards Fast Edit — {story?.author || uuid.slice(0, 8)}
        </h2>
        {/* Filter */}
        <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 140, maxWidth: 280 }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ash)', fontSize: '0.72rem', pointerEvents: 'none' }} />
          <input
            className="pg-input"
            style={{ paddingLeft: '1.6rem', fontSize: '0.78rem' }}
            placeholder="Filter cards…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        {dirtyCount > 0 && (
          <span style={{ color: 'var(--color-gold-light)', fontSize: '0.75rem', fontFamily: 'Cinzel, serif', whiteSpace: 'nowrap' }}>
            {dirtyCount} unsaved
          </span>
        )}
        {success && (
          <span className="pg-alert pg-alert-success" style={{ padding: '0.25rem 0.75rem', margin: 0 }}>
            <i className="fas fa-check-circle me-1" />{success}
          </span>
        )}
        <button
          type="button"
          className="pg-btn pg-btn-gold"
          onClick={saveAll}
          disabled={savingAll || dirtyCount === 0}
        >
          <i className={`fas ${savingAll ? 'fa-spinner fa-spin' : 'fa-save'} me-1`} />
          {savingAll ? 'Saving…' : `Save All${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
        </button>
      </div>

      <ErrorAlert message={error} onClose={() => setError('')} />

      {rows.length === 0 ? (
        <div className="pg-card" style={{ color: 'var(--color-ash)', textAlign: 'center', padding: '2rem' }}>
          No cards found for this story.
        </div>
      ) : (
        <div className="pg-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pg-table" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ width: 56, textAlign: 'center' }}>ID</th>
                  <th style={{ minWidth: 130 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <select
                        value={entityFilter}
                        onChange={e => setEntityFilter(e.target.value)}
                        aria-label="Filter by entity type" className="pg-input"
                        style={{
                          background: 'rgba(0,0,0,0.35)',
                          border: '1px solid rgba(200,150,10,0.3)',
                          borderRadius: 3,
                          color: 'var(--color-parchment)',
                          padding: '0.1rem 0.2rem',
                          fontFamily: 'Crimson Text, Georgia, serif',
                          outline: 'none',
                        }}
                      >
                        <option value="">All entity</option>
                        <option value="__none__">Unlinked</option>
                        {presentEntityTypes.map(t => (
                          <option key={t} value={t}>{prettyEntityType(t)}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th style={{ minWidth: 160 }}>Title Text</th>
                  <th style={{ minWidth: 160 }}>Desc Text</th>
                  <th style={{ minWidth: 100 }}>Copyright Text</th>
                  <th style={{ width: 90 }}>(c) Link</th>
                  <th style={{ width: 90 }}>ImgURL</th>
                  <th style={{ width: 70 }}>Creator</th>
                  <th style={{ width: 52 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-ash)', padding: '1.5rem' }}>No cards match the filter.</td></tr>
                )}
                {filteredRows.map(row => {
                  const dirty   = isDirty(row)
                  const isSaving = saving.has(row.uuid)
                  return (
                    <tr
                      key={row.uuid}
                      style={dirty ? { background: 'rgba(200,150,10,0.06)' } : {}}
                    >
                      <td style={{ ...CELL, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="pg-badge pg-badge-gold"
                          style={{ fontSize: '0.68rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                          onClick={() => setCardModal(row._orig)}
                          title="Edit full card"
                        >
                          #{row.idCard}
                        </button>
                      </td>

                      <td style={{ ...CELL, whiteSpace: 'nowrap' }}>
                        {(() => {
                          const entityTypes = getCardEntityTypes(row.idCard)
                          if (entityTypes.length === 0) {
                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <i
                                  className="fas fa-exclamation-triangle"
                                  style={{ color: 'var(--color-ember)', fontSize: '0.62rem' }}
                                  title="Card not referenced by any entity"
                                />
                                <button
                                  type="button"
                                  className="pg-btn pg-btn-danger pg-btn-sm"
                                  style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', lineHeight: 1 }}
                                  onClick={() => setDeleteConfirm({ cardUuid: row.uuid, idCard: row.idCard })}
                                  title="Delete unused card"
                                >
                                  <i className="fas fa-times" />
                                </button>
                              </span>
                            )
                          }
                          return (
                            <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 3 }}>
                              {entityTypes.map(t => (
                                <span
                                  key={t}
                                  className="pg-badge pg-badge-gold"
                                  style={{ fontSize: '0.6rem' }}
                                  title={`Linked to ${prettyEntityType(t)}`}
                                >
                                  {prettyEntityType(t)}
                                </span>
                              ))}
                            </span>
                          )
                        })()}
                      </td>

                      <td style={CELL}>
                        <TextFieldCell
                          value={row.idTextTitle}
                          textShort={getTextShort(row.idTextTitle)}
                          onOpenSelector={() => setActiveTextSel({ cardUuid: row.uuid, field: 'idTextTitle', startMode: 'list' })}
                          onOpenCreator={() => setActiveTextCreator({ cardUuid: row.uuid, field: 'idTextTitle' })}
                        />
                      </td>

                      <td style={CELL}>
                        <TextFieldCell
                          value={row.idTextDescription}
                          textShort={getTextShort(row.idTextDescription)}
                          onOpenSelector={() => setActiveTextSel({ cardUuid: row.uuid, field: 'idTextDescription', startMode: 'list' })}
                          onOpenCreator={() => setActiveTextCreator({ cardUuid: row.uuid, field: 'idTextDescription' })}
                          onAlert={
                            row.idTextTitle && row.idTextDescription &&
                            String(row.idTextTitle) === String(row.idTextDescription)
                              ? () => setSplitDescCreator({ cardUuid: row.uuid })
                              : undefined
                          }
                          onAlignAlert={
                            getMisalignedEntities(row).length > 0
                              ? () => handleAlignDescText(row)
                              : undefined
                          }
                        />
                      </td>

                      <td style={CELL}>
                        <TextFieldCell
                          value={row.idTextCopyright}
                          textShort={getTextShort(row.idTextCopyright, 11)}
                          maxWidth={80}
                          onOpenSelector={() => setActiveTextSel({ cardUuid: row.uuid, field: 'idTextCopyright', startMode: 'list' })}
                          onOpenCreator={() => setActiveTextCreator({ cardUuid: row.uuid, field: 'idTextCopyright' })}
                          onCreateNew={() => setCopyrightCreator({ cardUuid: row.uuid })}
                        />
                      </td>

                      <td style={CELL}>
                        <LinkFieldCell
                          value={row.linkCopyright}
                          onChange={e => updateRow(row.uuid, 'linkCopyright', e.target.value)}
                          ariaLabel="Copyright Link"
                        />
                      </td>

                      <td style={CELL}>
                        <LinkFieldCell
                          value={row.urlImage}
                          onChange={e => updateRow(row.uuid, 'urlImage', e.target.value)}
                          ariaLabel="Image URL"
                        />
                      </td>

                      <td style={CELL}>
                        <button
                          type="button"
                          className="pg-btn pg-btn-ghost pg-btn-sm"
                          style={{ fontSize: '0.7rem' }}
                          onClick={() => setActiveCreatorSel({ cardUuid: row.uuid })}
                          title={getCreatorLabel(row.idCreator)}
                        >
                          {row.idCreator || '—'}
                        </button>
                      </td>

                      <td style={{ ...CELL, textAlign: 'right' }}>
                        <button
                          type="button"
                          className={`pg-btn pg-btn-sm ${dirty ? 'pg-btn-gold' : 'pg-btn-ghost'}`}
                          onClick={() => saveRow(row)}
                          disabled={isSaving || !dirty}
                          title="Save this card"
                        >
                          <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'}`} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FastTextSelectorModal
        open={!!activeTextSel}
        onClose={() => setActiveTextSel(null)}
        texts={texts}
        selectedId={activeRow?.[activeTextSel?.field] ?? ''}
        storyOptions={storyOptions}
        storyUuid={uuid}
        onSaveFastText={handleSaveFastText}
        startMode={activeTextSel?.startMode || 'list'}
        onSelect={(idText) => {
          if (!activeTextSel) return
          updateRow(activeTextSel.cardUuid, activeTextSel.field, idText)
          setActiveTextSel(null)
        }}
      />

      <FastTextCreatorModal
        open={!!activeTextCreator}
        onClose={(result) => {
          if (result?.idText && activeTextCreator) {
            updateRow(activeTextCreator.cardUuid, activeTextCreator.field, result.idText)
          }
          setActiveTextCreator(null)
        }}
        storyOptions={storyOptions}
        initialStoryUuid={uuid}
        initialTextId={activeCreatorRowT?.[activeTextCreator?.field] ?? ''}
        initialValues={activeCreatorRowT && activeTextCreator
          ? getTextValues(activeCreatorRowT[activeTextCreator.field])
          : undefined}
        mode="edit"
        onSave={async ({ uuidStory, idText, translations }) =>
          handleSaveFastText({ uuidStory, idText, translations, mode: 'edit' })
        }
      />

      <PathsOptionsSelectorModal
        open={!!activeCreatorSel}
        onClose={() => setActiveCreatorSel(null)}
        selectedValue={activeCreatorRow?.idCreator ?? ''}
        title="Select Creator"
        searchPlaceholder="Search by id or label"
        options={creatorsOptions}
        onSelect={(value) => {
          if (!activeCreatorSel) return
          updateRow(activeCreatorSel.cardUuid, 'idCreator', Number(value))
          setActiveCreatorSel(null)
        }}
      />

      {splitDescCreator && (
        <FastTextCreatorModal
          open
          onClose={async (result) => {
            if (result?.idText && splitDescRow) {
              updateRow(splitDescRow.uuid, 'idTextDescription', result.idText)
              const updatedRow = { ...splitDescRow, idTextDescription: result.idText }
              try {
                await doSave(updatedRow)
                setSuccess(`Card #${splitDescRow.idCard} saved with new Desc Text #${result.idText}`)
                setTimeout(() => setSuccess(''), 3000)
              } catch (e) {
                setError(e.message)
              }
            }
            setSplitDescCreator(null)
          }}
          storyOptions={storyOptions}
          initialStoryUuid={uuid}
          initialTextId={nextTextId}
          initialValues={splitDescRow ? getTextValues(splitDescRow.idTextDescription) : undefined}
          mode="create"
          onSave={async ({ uuidStory, idText, translations }) =>
            handleSaveFastText({ uuidStory, idText, translations, mode: 'edit' })
          }
        />
      )}

      {copyrightCreator && (
        <FastTextCreatorModal
          open
          onClose={async (result) => {
            if (result?.idText && copyrightRow) {
              updateRow(copyrightRow.uuid, 'idTextCopyright', result.idText)
              const updatedRow = { ...copyrightRow, idTextCopyright: result.idText }
              try {
                await doSave(updatedRow)
                setSuccess(`Card #${copyrightRow.idCard} saved with new Copyright Text #${result.idText}`)
                setTimeout(() => setSuccess(''), 3000)
              } catch (e) {
                setError(e.message)
              }
            }
            setCopyrightCreator(null)
          }}
          storyOptions={storyOptions}
          initialStoryUuid={uuid}
          initialTextId={nextTextId}
          initialValues={copyrightRow ? getTextValues(copyrightRow.idTextCopyright) : undefined}
          mode="create"
          onSave={async ({ uuidStory, idText, translations }) =>
            handleSaveFastText({ uuidStory, idText, translations, mode: 'edit' })
          }
        />
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Card"
          message={`Delete card #${deleteConfirm.idCard}? This card is not referenced by any entity. This action cannot be undone.`}
          onConfirm={handleDeleteCard}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {cardModal && (
        <EntityForm
          entity={cardModal}
          fields={FIELDS['cards']}
          onSave={handleSaveCardModal}
          onCancel={() => setCardModal(null)}
          storyUuid={uuid}
          storyOptions={storyOptions}
          texts={texts}
          onSaveFastText={handleSaveFastText}
          pathSelectorOptions={{ idCreator: { options: creatorsOptions } }}
        />
      )}
    </div>
  )
}

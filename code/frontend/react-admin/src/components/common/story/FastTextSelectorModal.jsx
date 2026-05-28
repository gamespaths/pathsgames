import { useEffect, useMemo, useRef, useState } from 'react'
import FastTextCreatorModal from './FastTextCreatorModal'

function groupTextsById(texts) {
  const grouped = new Map()

  texts.forEach(item => {
    const id = Number(item.idText)
    if (!grouped.has(id)) {
      grouped.set(id, { idText: id, en: null, it: null })
    }
    const row = grouped.get(id)
    if (item.lang === 'en') row.en = item
    if (item.lang === 'it') row.it = item
  })

  return [...grouped.values()].sort((a, b) => a.idText - b.idText)
}

export default function FastTextSelectorModal({
  open,
  onClose,
  texts,
  selectedId,
  storyOptions,
  storyUuid,
  onSelect,
  onSaveFastText,
  startMode = 'list',
}) {
  const [search, setSearch] = useState('')
  const [creatorState, setCreatorState] = useState({ open: false, mode: 'create', idText: null, values: null })
  const [viewMode, setViewMode] = useState('list')
  const [generatedText, setGeneratedText] = useState('')
  const [generatorSaving, setGeneratorSaving] = useState(false)
  const [generatorError, setGeneratorError] = useState('')
  const wasOpenRef = useRef(false)
  const generatorInputRef = useRef(null)

  const grouped = useMemo(() => groupTextsById(texts || []), [texts])

  const generatedId = useMemo(() => {
    if (!grouped.length) return 1
    const usedIds = new Set(grouped.map(g => Number(g.idText)))
    let candidate = Math.max(...grouped.map(g => Number(g.idText))) + 1
    while (usedIds.has(candidate)) {
      candidate += 1
    }
    return candidate
  }, [grouped])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return grouped
    return grouped.filter(row => {
      const enShort = row.en?.shortText?.toLowerCase() || ''
      const itShort = row.it?.shortText?.toLowerCase() || ''
      return String(row.idText).includes(q) || enShort.includes(q) || itShort.includes(q)
    })
  }, [grouped, search])

  const openCreate = () => {
    setViewMode('input-generator')
    setGeneratedText('')
    setGeneratorError('')
    setGeneratorSaving(false)
  }

  useEffect(() => {
    if (open && !wasOpenRef.current && startMode === 'input-generator') {
      openCreate()
    } else if (open && !wasOpenRef.current) {
      setViewMode('list')
      setGeneratedText('')
      setGeneratorError('')
      setGeneratorSaving(false)
    }
    wasOpenRef.current = open
  }, [open, startMode, generatedId])

  useEffect(() => {
    if (!open) {
      setGeneratorSaving(false)
      setGeneratorError('')
    }
  }, [open])

  useEffect(() => {
    if (!open || viewMode !== 'input-generator') return
    const timer = setTimeout(() => {
      generatorInputRef.current?.focus()
      generatorInputRef.current?.select()
    }, 0)
    return () => clearTimeout(timer)
  }, [open, viewMode])

  if (!open) return null

  const openEdit = (row) => {
    setCreatorState({
      open: true,
      mode: 'edit',
      idText: row.idText,
      values: {
        en: { shortText: row.en?.shortText || '', longText: row.en?.longText || '' },
        it: { shortText: row.it?.shortText || '', longText: row.it?.longText || '' },
      },
    })
  }

  const handleCreatorClose = async (result) => {
    setCreatorState({ open: false, mode: 'create', idText: null, values: null })
    if (!result) return
    const selected = Number(result.idText)
    onSelect(selected)
  }

  const handleSaveGeneratedText = async () => {
    const cleanText = generatedText.trim()
    if (!cleanText || generatorSaving) return

    setGeneratorSaving(true)
    setGeneratorError('')

    try {
      const result = await onSaveFastText({
        uuidStory: storyUuid,
        idText: generatedId,
        mode: 'input-generator',
        translations: {
          en: { shortText: cleanText, longText: cleanText },
        },
      })

      setGeneratorSaving(false)
      const selected = Number(result?.idText ?? generatedId)
      onSelect(selected)
      onClose()
    } catch (e) {
      setGeneratorError(e?.message || 'Cannot save generated text')
      setGeneratorSaving(false)
    }
  }

  return (
    <>
      <div className="pg-modal-backdrop" onClick={onClose}>
        <div className="pg-modal" style={{ maxWidth: 920, width: '95vw' }} onClick={e => e.stopPropagation()}>
          <h3 className="pg-modal-title"><i className="fas fa-search me-2" /> Fast Text Selector</h3>

          {viewMode === 'input-generator' ? (
            <div className="mt-4">
              <div className="pg-alert pg-alert-warning mb-3">
                <i className="fas fa-wand-magic-sparkles" />
                New text generator — ID #{generatedId}
              </div>
              <input
                ref={generatorInputRef}
                className="pg-input"
                placeholder="Insert text value"
                value={generatedText}
                onChange={e => setGeneratedText(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (generatorSaving || !generatedText.trim()) return
                  handleSaveGeneratedText()
                }}
              />
              {generatorError && (
                <div className="pg-alert pg-alert-danger mt-3">
                  <i className="fas fa-exclamation-triangle" /> {generatorError}
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="pg-btn pg-btn-ghost"
                  onClick={() => {
                    setViewMode('list')
                    setGeneratedText('')
                    setGeneratorError('')
                  }}
                >
                  <i className="fas fa-times" />
                </button>
                <button
                  type="button"
                  className="pg-btn pg-btn-gold"
                  onClick={handleSaveGeneratedText}
                  disabled={generatorSaving || !generatedText.trim()}
                >
                  {generatorSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mt-4 mb-3">
                <input
                  className="pg-input"
                  placeholder="Search by text id, EN or IT short text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <button type="button" className="pg-btn pg-btn-gold" onClick={openCreate}>
                  <i className="fas fa-plus" /> New
                </button>
              </div>

              <div className="pg-fast-selector-list">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>ID</th>
                      <th>EN Short</th>
                      <th>IT Short</th>
                      <th style={{ width: 160 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(row => (
                      <tr key={row.idText}>
                        <td>#{row.idText}</td>
                        <td>{row.en?.shortText || '—'}</td>
                        <td>{row.it?.shortText || '—'}</td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="pg-btn pg-btn-ghost pg-btn-sm"
                              onClick={() => { onSelect(row.idText); onClose() }}
                            >
                              {Number(selectedId) === Number(row.idText) ? 'Selected' : 'Select'}
                            </button>
                            <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={() => openEdit(row)}>
                              <i className="fas fa-pen" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filtered.length && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No text found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-4">
                <button type="button" className="pg-btn pg-btn-ghost" onClick={onClose}>Close</button>
              </div>
            </>
          )}
        </div>
      </div>

      <FastTextCreatorModal
        open={creatorState.open}
        onClose={handleCreatorClose}
        onSave={onSaveFastText}
        storyOptions={storyOptions}
        initialStoryUuid={storyUuid}
        initialTextId={creatorState.idText}
        initialValues={creatorState.values}
        mode={creatorState.mode}
      />
    </>
  )
}

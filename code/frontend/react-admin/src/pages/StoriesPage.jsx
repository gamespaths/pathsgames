import { useEffect, useState } from 'react'
import { listAllStories, deleteStory } from '../api/storyApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import ConfirmModal from '../components/common/ConfirmModal'
import { Link } from 'react-router-dom'

export default function StoriesPage() {
  const [stories,  setStories]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [filter,   setFilter]   = useState('')
  const [lang,     setLang]     = useState('en')
  const [modal,    setModal]    = useState(null)
  const [detail,   setDetail]   = useState(null)

  const load = () => {
    setLoading(true); setError('')
    listAllStories(lang)
      .then(data => { setStories(data); setLoading(false) })
      .catch(e  => { setError(e.message); setLoading(false) })
  }

  useEffect(load, [lang])

  const handleDeleteConfirm = async () => {
    const uuid = modal
    setModal(null)
    try {
      await deleteStory(uuid)
      setSuccess(`Story ${uuid.slice(0, 8)}… deleted.`)
      load()
    } catch (e) { setError(e.message) }
  }

  const filtered = stories.filter(s =>
    !filter ||
    s.title?.toLowerCase().includes(filter.toLowerCase()) ||
    s.uuid?.toLowerCase().includes(filter.toLowerCase()) ||
    s.author?.toLowerCase().includes(filter.toLowerCase()) ||
    s.category?.toLowerCase().includes(filter.toLowerCase())
  )

  const visColor = { PUBLIC: 'pg-badge-success', PRIVATE: 'pg-badge-danger', DRAFT: 'pg-badge-warning' }

  return (
    <div>
      <h2 className="pg-page-title"><i className="fas fa-book-open" />Stories</h2>

      <ErrorAlert message={error} onClose={() => setError('')} />
      {success && (
        <div className="pg-alert pg-alert-success mb-4">
          <i className="fas fa-check-circle me-2" />{success}
          <button className="ml-auto" onClick={() => setSuccess('')}><i className="fas fa-times" /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ash)', fontSize: '0.8rem' }} />
          <input
            className="pg-input pl-8"
            placeholder="Filter by title, UUID, author, category…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="pg-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
            <i className="fas fa-language me-1" />Lang
          </label>
          <select className="pg-input" style={{ width: '70px' }} value={lang} onChange={e => setLang(e.target.value)}>
            {['en','it','de','fr','es','pt'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <button className="pg-btn pg-btn-ghost" onClick={load}>
          <i className="fas fa-sync-alt" /> Refresh
        </button>
        <Link to="/stories/import" className="pg-btn pg-btn-gold">
          <i className="fas fa-file-import" /> Import Story
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading stories…" />
      ) : (
        <div className="pg-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th>Group</th>
                  <th>Visibility</th>
                  <th>Priority</th>
                  <th>PEGHI</th>
                  <th>Difficulties</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No stories found.</td></tr>
                )}
                {filtered.map(s => (
                  <tr key={s.uuid}>
                    <td>
                      {s.card?.awesomeIcon && (
                        <i className={`fas ${s.card.awesomeIcon} me-2`} style={{ color: 'var(--color-gold-dark)' }} />
                      )}
                      <span style={{ fontWeight: 600 }}>{s.title || <em style={{ color: 'var(--color-ash)' }}>Untitled</em>}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{s.author || '—'}</td>
                    <td>{s.category ? <span className="pg-badge pg-badge-info">{s.category}</span> : '—'}</td>
                    <td>{s.group ? <span className="pg-badge pg-badge-gold">{s.group}</span> : '—'}</td>
                    <td>
                      <span className={`pg-badge ${visColor[s.visibility] || 'pg-badge-warning'}`}>
                        {s.visibility || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{s.priority ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.peghi ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.difficultyCount ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="pg-btn pg-btn-ghost pg-btn-sm me-1" onClick={() => setDetail(s)} title="View">
                        <i className="fas fa-eye" />
                      </button>
                      <button className="pg-btn pg-btn-danger pg-btn-sm" onClick={() => setModal(s.uuid)} title="Delete">
                        <i className="fas fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {modal && (
        <ConfirmModal
          title="Delete Story"
          message={`Delete story ${modal.slice(0, 8)}… and ALL its related data? This cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Detail modal */}
      {detail && (
        <div className="pg-modal-backdrop" onClick={() => setDetail(null)}>
          <div className="pg-modal" style={{ maxWidth: 600, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <p className="pg-modal-title">
              <i className="fas fa-book-open me-2" />
              {detail.title || 'Story Detail'}
            </p>
            <table className="pg-table" style={{ fontSize: '0.82rem' }}>
              <tbody>
                {Object.entries(detail).filter(([, v]) => v !== null && !Array.isArray(v) && typeof v !== 'object').map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ fontFamily: 'Cinzel, serif', fontSize: '0.68rem', color: 'var(--color-gold-dark)', whiteSpace: 'nowrap' }}>{k}</td>
                    <td style={{ wordBreak: 'break-all' }}>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.difficulties?.length > 0 && (
              <div className="mt-3">
                <p className="pg-card-title mb-1">Difficulties ({detail.difficulties.length})</p>
                {detail.difficulties.map((d, i) => (
                  <div key={i} className="mb-1" style={{ fontSize: '0.8rem', color: 'var(--color-ash)' }}>
                    #{i + 1} — expCost: {d.expCost} | maxWeight: {d.maxWeight} | chars: {d.minCharacter}-{d.maxCharacter}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-3">
              <button className="pg-btn pg-btn-ghost" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

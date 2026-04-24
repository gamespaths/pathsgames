import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getStory, listEntities, updateStory, deleteEntity, createEntity, updateEntity } from '../api/storyApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import EntityTable from '../components/common/EntityTable'
import EntityForm from '../components/common/EntityForm'
import ConfirmModal from '../components/common/ConfirmModal'

const TABS = [
  { id: 'metadata', label: 'Story Info', icon: 'fa-info-circle' },
  { id: 'difficulties', label: 'Difficulties', icon: 'fa-layer-group' },
  { id: 'locations', label: 'Locations', icon: 'fa-map-marker-alt' },
  { id: 'events', label: 'Events', icon: 'fa-bolt' },
  { id: 'items', label: 'Items', icon: 'fa-flask' },
  { id: 'character-templates', label: 'Templates', icon: 'fa-user-tag' },
  { id: 'classes', label: 'Classes', icon: 'fa-hat-wizard' },
  { id: 'traits', label: 'Traits', icon: 'fa-star' },
  { id: 'creators', label: 'Creators', icon: 'fa-paint-brush' },
  { id: 'cards', label: 'Cards', icon: 'fa-id-card' },
  { id: 'texts', label: 'Texts', icon: 'fa-font' },
]

export default function StoryEditorPage() {
  const { uuid } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('metadata')
  const [story, setStory] = useState(null)
  const [entities, setEntities] = useState([])
  const [texts, setTexts] = useState([]) // All texts for resolution
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState(null) // { type, entity }

  const loadStory = async () => {
    try {
      const data = await getStory(uuid)
      setStory(data)
      const txts = await listEntities(uuid, 'texts')
      setTexts(txts)
      setLoading(false)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  const loadEntities = async () => {
    if (activeTab === 'metadata') return
    try {
      const data = await listEntities(uuid, activeTab)
      setEntities(data)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { loadStory() }, [uuid])
  useEffect(() => { loadEntities() }, [activeTab])

  const handleUpdateStory = async (e) => {
    e.preventDefault()
    try {
      await updateStory(uuid, story)
      setSuccess('Story metadata updated successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) { setError(e.message) }
  }

  const handleDeleteEntity = async () => {
    const { entity } = modal
    setModal(null)
    try {
      await deleteEntity(uuid, activeTab, entity.uuid)
      setSuccess(`${activeTab} entity deleted`)
      loadEntities()
      if (activeTab === 'texts') {
        const txts = await listEntities(uuid, 'texts')
        setTexts(txts)
      }
    } catch (e) { setError(e.message) }
  }

  const handleSaveEntity = async (data) => {
    try {
      if (modal.entity) {
        await updateEntity(uuid, activeTab, modal.entity.uuid, data)
      } else {
        await createEntity(uuid, activeTab, data)
      }
      setSuccess(`${activeTab} saved`)
      setModal(null)
      loadEntities()
      if (activeTab === 'texts') {
        const txts = await listEntities(uuid, 'texts')
        setTexts(txts)
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) { setError(e.message) }
  }

  if (loading) return <LoadingSpinner text="Loading story data..." />

  // Column definitions for each entity type
  const COLUMNS = {
    difficulties: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'expCost', label: 'EXP Cost' },
      { key: 'maxWeight', label: 'Max Weight' },
    ],
    locations: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'idTextDescription', label: 'Desc', type: 'idTextDescription' },
      { key: 'isSafe', label: 'Safe', render: e => e.isSafe ? 'Yes' : 'No' },
    ],
    events: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'eventType', label: 'Type' },
      { key: 'triggerType', label: 'Trigger' },
    ],
    items: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'weight', label: 'Weight' },
    ],
    texts: [
      { key: 'idText', label: 'ID Text', render: e => <span className="font-mono text-gold-dark">#{e.idText}</span> },
      { key: 'lang', label: 'Lang', render: e => <span className="pg-badge pg-badge-info">{e.lang}</span> },
      { key: 'shortText', label: 'Short Text' },
      { key: 'longText', label: 'Long Text', render: e => e.longText ? <i className="fas fa-file-alt text-ash" title={e.longText} /> : '—' },
    ],
    cards: [
      { key: 'idTextName', label: 'Title', type: 'idTextName' },
      { key: 'cardType', label: 'Type' },
      { key: 'imageUrl', label: 'Image', render: e => e.imageUrl ? <i className="fas fa-image" title={e.imageUrl} /> : '—' },
    ],
    creators: [
      { key: 'creatorName', label: 'Name' },
      { key: 'creatorRole', label: 'Role' },
    ]
  }

  const FIELDS = {
    difficulties: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'expCost', label: 'EXP Cost', type: 'number' },
      { key: 'maxWeight', label: 'Max Weight', type: 'number' },
      { key: 'minCharacter', label: 'Min Characters', type: 'number' },
      { key: 'maxCharacter', label: 'Max Characters', type: 'number' },
    ],
    locations: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'isSafe', label: 'Safe Location', type: 'checkbox' },
    ],
    texts: [
      { key: 'idText', label: 'Text ID', type: 'number' },
      { key: 'lang', label: 'Language', type: 'text' },
      { key: 'shortText', label: 'Short Text', type: 'text' },
      { key: 'longText', label: 'Long Text', type: 'textarea' },
    ],
    events: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'eventType', label: 'Event Type', type: 'text' },
      { key: 'triggerType', label: 'Trigger Type', type: 'text' },
    ],
    items: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'weight', label: 'Weight', type: 'number' },
    ]
  }

  const defaultCols = [
    { key: 'idTextName', label: 'Name', type: 'idTextName' },
    { key: 'uuid', label: 'UUID', render: e => <small className="text-white/20">{e.uuid?.slice(0, 8)}...</small> }
  ]

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar Tabs */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="pg-card sticky top-4" style={{ padding: '0.5rem' }}>
          <div className="mb-4 p-3 border-b border-white/5">
            <button className="pg-btn pg-btn-ghost pg-btn-sm w-full justify-start mb-2" onClick={() => navigate('/stories')}>
              <i className="fas fa-arrow-left me-2" /> Back to list
            </button>
            <h3 className="pg-card-title text-gold-dark" style={{ fontSize: '0.9rem' }}>
              Editing Story
            </h3>
            <p className="text-xs text-white/40 truncate" title={uuid}>{uuid}</p>
          </div>
          <nav className="flex flex-col gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded transition-all text-sm ${
                  activeTab === tab.id ? 'bg-gold-dark/20 text-gold-light' : 'text-ash hover:bg-white/5'
                }`}
              >
                <i className={`fas ${tab.icon} w-5 text-center`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow min-w-0">
        <ErrorAlert message={error} onClose={() => setError('')} />
        {success && (
          <div className="pg-alert pg-alert-success mb-4">
            <i className="fas fa-check-circle me-2" />{success}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="pg-page-title" style={{ marginBottom: 0 }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          {activeTab !== 'metadata' && (
            <button className="pg-btn pg-btn-gold pg-btn-sm" onClick={() => setModal({ type: 'form', entity: null })}>
              <i className="fas fa-plus me-1" /> Add {TABS.find(t => t.id === activeTab)?.label.slice(0, -1)}
            </button>
          )}
        </div>

        {activeTab === 'metadata' ? (
          <form onSubmit={handleUpdateStory} className="pg-card flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="pg-label">Author</label>
                <input className="pg-input" value={story.author || ''} onChange={e => setStory({...story, author: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Category</label>
                <input className="pg-input" value={story.category || ''} onChange={e => setStory({...story, category: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Group</label>
                <input className="pg-input" value={story.group || ''} onChange={e => setStory({...story, group: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Visibility</label>
                <select className="pg-input" value={story.visibility || 'DRAFT'} onChange={e => setStory({...story, visibility: e.target.value})}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="PRIVATE">PRIVATE</option>
                </select>
              </div>
              <div>
                <label className="pg-label">Priority</label>
                <input type="number" className="pg-input" value={story.priority || 0} onChange={e => setStory({...story, priority: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="pg-label">PEGHI</label>
                <input type="number" className="pg-input" value={story.peghi || 0} onChange={e => setStory({...story, peghi: parseInt(e.target.value)})} />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" className="pg-btn pg-btn-gold px-8">
                <i className="fas fa-save me-2" /> Save Changes
              </button>
            </div>
          </form>
        ) : (
          <EntityTable
            entities={entities}
            columns={COLUMNS[activeTab] || defaultCols}
            texts={texts}
            onEdit={(ent) => setModal({ type: 'form', entity: ent })}
            onDelete={(ent) => setModal({ type: 'delete', entity: ent })}
          />
        )}
      </div>

      {modal?.type === 'form' && (
        <EntityForm
          entity={modal.entity}
          fields={FIELDS[activeTab] || [{ key: 'idTextName', label: 'Name Text ID', type: 'number' }]}
          onSave={handleSaveEntity}
          onCancel={() => setModal(null)}
        />
      )}

      {modal?.type === 'delete' && (
        <ConfirmModal
          title={`Delete ${activeTab.slice(0, -1)}`}
          message={`Are you sure you want to delete this ${activeTab.slice(0, -1)}?`}
          onConfirm={handleDeleteEntity}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}

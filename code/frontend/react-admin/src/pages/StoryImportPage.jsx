import { useState } from 'react'
import { importStory } from '../api/storyApi'
import ErrorAlert from '../components/common/ErrorAlert'

const EXAMPLE = JSON.stringify({
  uuid: null,
  author: "GameMaster",
  category: "adventure",
  group: "fantasy",
  visibility: "PUBLIC",
  priority: 5,
  peghi: 2,
  versionMin: "0.10",
  versionMax: "1.0",
  idTextClockSingular: 10,
  idTextClockPlural: 11,
  linkCopyright: "https://example.com",
  idTextTitle: 1,
  idTextDescription: 2,
  idTextCopyright: 3,
  texts: [
    { idText: 1, lang: "en", shortText: "My Story" },
    { idText: 2, lang: "en", shortText: "A great adventure" },
  ],
  difficulties: [
    { idTextDescription: 10, expCost: 5, maxWeight: 10, minCharacter: 1, maxCharacter: 4 }
  ],
  locations: [],
  events: [],
  items: [],
}, null, 2)

export default function StoryImportPage() {
  const [json,    setJson]    = useState('')
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleImport = async () => {
    setError(''); setResult(null)
    let parsed
    try {
      parsed = JSON.parse(json)
    } catch {
      setError('Invalid JSON — please check your input.')
      return
    }
    setLoading(true)
    try {
      const res = await importStory(parsed)
      setResult(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadExample = () => setJson(EXAMPLE)

  return (
    <div>
      <h2 className="pg-page-title"><i className="fas fa-file-import" />Import Story</h2>

      <div className="pg-card mb-4">
        <p style={{ color: 'var(--color-ash)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          <i className="fas fa-info-circle me-1" style={{ color: 'var(--color-gold-dark)' }} />
          Paste a complete story JSON here. If the UUID already exists it will be
          <strong style={{ color: 'var(--color-gold-light)' }}> completely replaced</strong>.
          Leave <code style={{ color: 'var(--color-gold-dark)' }}>uuid: null</code> to auto-generate a new UUID.
        </p>
        <button className="pg-btn pg-btn-ghost pg-btn-sm" onClick={loadExample}>
          <i className="fas fa-magic me-1" />Load example JSON
        </button>
      </div>

      <ErrorAlert message={error} onClose={() => setError('')} />

      {result && (
        <div className="pg-alert pg-alert-success mb-4">
          <div>
            <i className="fas fa-check-circle me-2" />
            <strong>Story imported successfully!</strong>
          </div>
          <table style={{ marginTop: '0.5rem', fontSize: '0.82rem', width: '100%' }}>
            <tbody>
              {Object.entries(result).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ fontFamily: 'Cinzel, serif', color: 'var(--color-gold-dark)', paddingRight: '1rem', fontSize: '0.7rem' }}>{k}</td>
                  <td>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3">
        <label className="pg-label">
          <i className="fas fa-code me-1" />
          Story JSON
        </label>
        <textarea
          className="pg-textarea"
          rows={24}
          value={json}
          onChange={e => setJson(e.target.value)}
          placeholder={'{\n  "uuid": null,\n  "author": "...",\n  ...\n}'}
          spellCheck={false}
          style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
        />
      </div>

      <button
        className="pg-btn pg-btn-gold"
        onClick={handleImport}
        disabled={loading || !json.trim()}
      >
        {loading
          ? <><span className="pg-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Importing…</>
          : <><i className="fas fa-upload" /> Import Story</>
        }
      </button>
    </div>
  )
}

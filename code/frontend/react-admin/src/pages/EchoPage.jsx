import { useEffect, useState } from 'react'
import { getServerStatus } from '../api/echoApi'
import LoadingSpinner from '../components/common/LoadingSpinner'

export default function EchoPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [lastCheck, setLastCheck] = useState(null)

  const load = () => {
    setLoading(true); setError('')
    getServerStatus()
      .then(d => { setData(d); setLoading(false); setLastCheck(new Date()) })
      .catch(e => { setError(e.message); setLoading(false); setLastCheck(new Date()) })
  }

  useEffect(load, [])

  const online = !!data

  return (
    <div>
      <h2 className="pg-page-title"><i className="fas fa-heartbeat" />Server Status</h2>

      <div className="flex items-center gap-3 mb-5">
        <span className={`status-dot ${loading ? 'loading' : online ? 'online' : 'offline'}`} />
        <span style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '1rem',
          color: online ? 'var(--status-online)' : 'var(--status-offline)',
        }}>
          Server {loading ? 'Checking…' : online ? 'Online' : 'Offline'}
        </span>
        {lastCheck && (
          <span style={{ color: 'var(--color-ash)', fontSize: '0.8rem', marginLeft: 'auto' }}>
            <i className="fas fa-clock me-1" />Last checked: {lastCheck.toLocaleTimeString()}
          </span>
        )}
        <button className="pg-btn pg-btn-ghost pg-btn-sm" onClick={load}>
          <i className="fas fa-sync-alt" /> Refresh
        </button>
      </div>

      {error && (
        <div className="pg-alert pg-alert-danger mb-4">
          <i className="fas fa-exclamation-triangle me-2" />{error}
        </div>
      )}

      {loading && <LoadingSpinner text="Pinging server…" />}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status */}
          <div className="pg-card">
            <div className="pg-card-title mb-2"><i className="fas fa-info-circle me-1" />Status Info</div>
            <table className="pg-table">
              <tbody>
                <tr>
                  <td style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'var(--color-gold-dark)' }}>Status</td>
                  <td><span className="pg-badge pg-badge-success">{data.status}</span></td>
                </tr>
                <tr>
                  <td style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'var(--color-gold-dark)' }}>Timestamp</td>
                  <td style={{ fontSize: '0.85rem' }}>{data.timestamp ? new Date(data.timestamp).toLocaleString() : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Properties */}
          {data.properties && (
            <div className="pg-card">
              <div className="pg-card-title mb-2"><i className="fas fa-cogs me-1" />Server Properties</div>
              <table className="pg-table">
                <tbody>
                  {Object.entries(data.properties).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'var(--color-gold-dark)' }}>{k}</td>
                      <td style={{ fontSize: '0.85rem' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Raw JSON */}
          <div className="pg-card md:col-span-2">
            <div className="pg-card-title mb-2"><i className="fas fa-code me-1" />Raw Response</div>
            <pre style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(200,150,10,0.15)',
              borderRadius: 5,
              padding: '0.8rem',
              fontSize: '0.78rem',
              overflowX: 'auto',
              color: 'var(--color-parchment)',
              fontFamily: 'monospace',
            }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

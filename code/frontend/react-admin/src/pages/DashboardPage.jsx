import { useEffect, useState } from 'react'
import { getServerStatus } from '../api/echoApi'
import { getGuestStats } from '../api/guestApi'
import { listAllStories } from '../api/storyApi'
import LoadingSpinner from '../components/common/LoadingSpinner'

function StatCard({ icon, label, value, colorClass = '', sub }) {
  return (
    <div className="pg-card">
      <div className="pg-card-title">
        <i className={`${icon} me-1`} />
        {label}
      </div>
      <div className={`pg-stat-value ${colorClass}`}>{value ?? '—'}</div>
      {sub && <div style={{ color: 'var(--color-ash)', fontSize: '0.78rem', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const [serverData,  setServerData]  = useState(null)
  const [guestStats,  setGuestStats]  = useState(null)
  const [storyCount,  setStoryCount]  = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      getServerStatus(),
      getGuestStats(),
      listAllStories(),
    ]).then(([srv, guests, stories]) => {
      if (srv.status    === 'fulfilled') setServerData(srv.value)
      if (guests.status === 'fulfilled') setGuestStats(guests.value)
      if (stories.status=== 'fulfilled') setStoryCount(stories.value.length)
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingSpinner text="Loading dashboard…" />

  return (
    <div>
      <h2 className="pg-page-title"><i className="fas fa-tachometer-alt" />Dashboard</h2>

      {/* Server status row */}
      <div className="mb-6">
        <div className="pg-card">
          <div className="flex items-center gap-3">
            <span className={`status-dot ${serverData ? 'online' : 'offline'}`} />
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'var(--color-gold-light)' }}>
              Server {serverData ? 'Online' : 'Offline'}
            </span>
            {serverData?.properties?.version && (
              <span className="pg-badge pg-badge-gold">v{serverData.properties.version}</span>
            )}
            {serverData?.timestamp && (
              <span style={{ color: 'var(--color-ash)', fontSize: '0.78rem', marginLeft: 'auto' }}>
                <i className="fas fa-clock me-1" />
                {new Date(serverData.timestamp).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="fas fa-users"
          label="Total Guests"
          value={guestStats?.totalGuests}
        />
        <StatCard
          icon="fas fa-user-check"
          label="Active Guests"
          value={guestStats?.activeGuests}
          colorClass="text-green-400"
        />
        <StatCard
          icon="fas fa-user-clock"
          label="Expired Guests"
          value={guestStats?.expiredGuests}
          colorClass=""
        />
        <StatCard
          icon="fas fa-book-open"
          label="Stories (all)"
          value={storyCount}
          colorClass=""
        />
      </div>

      {/* Quick actions */}
      <div className="pg-card">
        <div className="pg-card-title mb-3">
          <i className="fas fa-bolt me-1" />
          Quick Actions
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/guests" className="pg-btn pg-btn-gold">
            <i className="fas fa-user-secret" />
            Manage Guests
          </a>
          <a href="/stories" className="pg-btn pg-btn-gold">
            <i className="fas fa-book-open" />
            Manage Stories
          </a>
          <a href="/stories/import" className="pg-btn pg-btn-ghost">
            <i className="fas fa-file-import" />
            Import Story
          </a>
          <a href="/echo" className="pg-btn pg-btn-ghost">
            <i className="fas fa-heartbeat" />
            Server Status
          </a>
        </div>
      </div>
    </div>
  )
}

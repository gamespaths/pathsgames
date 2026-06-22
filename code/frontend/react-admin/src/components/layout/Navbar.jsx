import { useState, useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getServerStatus } from '../../api/echoApi'

const MENU = [
  { section: 'Overview' },
  { to: '/',             icon: 'fas fa-tachometer-alt', label: 'Dashboard'     },
  { section: 'Guests' },
  { to: '/guests',       icon: 'fas fa-user-secret',    label: 'Guest Users'   },
  { section: 'Stories' },
  { to: '/stories',        icon: 'fas fa-book-open',    label: 'Stories'      },
  { to: '/stories/import', icon: 'fas fa-file-import',  label: 'Import Story' },
  { section: 'Matches' },
  { to: '/matches',      icon: 'fas fa-gamepad',        label: 'Matches'       },
  { section: 'System' },
  { to: '/echo',         icon: 'fas fa-heartbeat',      label: 'Server Status' },
]

export default function Navbar() {
  const { token, server, servers, logout, changeServer } = useAuth()
  const [status, setStatus]   = useState('loading')
  const [version, setVersion] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    getServerStatus()
      .then(data => {
        if (!cancelled) {
          setStatus('online')
          setVersion(data?.properties?.version || '')
        }
      })
      .catch(() => { if (!cancelled) setStatus('offline') })
    return () => { cancelled = true }
  }, [server])

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const statusLabel = { loading: 'Checking…', online: 'Online', offline: 'Offline' }

  return (
    <nav className="pg-navbar">
      {/* Navigation dropdown */}
      <div className="pg-nav-dropdown" ref={dropdownRef}>
        <button
          className="pg-btn pg-btn-ghost pg-btn-sm"
          onClick={() => setMenuOpen(prev => !prev)}
          aria-expanded={menuOpen}
          aria-label="Navigation menu"
        >
          <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'}`} />
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', marginLeft: '0.3rem' }}>Menu</span>
        </button>
        {menuOpen && (
          <div className="pg-nav-dropdown-menu" role="menu">
            {MENU.map((item, i) =>
              item.section
                ? <p key={i} className="pg-nav-dropdown-section">{item.section}</p>
                : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `pg-nav-dropdown-link${isActive ? ' active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    <i className={item.icon} />
                    {item.label}
                  </NavLink>
                )
            )}
          </div>
        )}
      </div>

      {/* Brand */}
      <a className="pg-navbar-brand" href="/">
        <i className="fas fa-dice-d20 dice-bounce me-2" />
        Paths Games
        <span style={{ color: 'var(--color-ember)', marginLeft: '0.4rem' }}>ADMIN</span>
      </a>

      {/* Server selector */}
      <div className="flex items-center gap-2 flex-1 max-w-xs mx-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(200,150,10,0.2)' }}>
          <i className="fas fa-server" style={{ color: 'var(--color-gold-dark)', fontSize: '0.7rem' }} />
          <select
            value={server}
            onChange={e => changeServer(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-gold-light)',
              fontFamily: 'Cinzel, serif',
              fontSize: '0.68rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {servers.map(s => (
              <option key={s.url} value={s.url} style={{ background: '#2e1508' }}>{s.label}</option>
            ))}
          </select>
          <span className={`status-dot ${status}`} />
          <span style={{ color: 'var(--color-ash)', fontSize: '0.65rem', fontFamily: 'Cinzel, serif' }}>
            {statusLabel[status]}
          </span>
          {version && (
            <span className="server-badge ms-1">{version}</span>
          )}
        </div>
      </div>

      {/* User / logout */}
      <div className="ms-auto flex items-center gap-3">
        {token && (
          <span style={{ color: 'var(--color-ash)', fontSize: '0.72rem', fontFamily: 'Cinzel, serif' }}>
            <i className="fas fa-key me-1" style={{ color: 'var(--color-gold-dark)' }} />
            JWT active
          </span>
        )}
        <button className="pg-btn pg-btn-ghost pg-btn-sm" onClick={logout}>
          <i className="fas fa-sign-out-alt" /> Logout
        </button>
      </div>
    </nav>
  )
}

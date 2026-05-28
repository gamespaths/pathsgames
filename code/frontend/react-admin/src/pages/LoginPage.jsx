import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, server, servers, changeServer } = useAuth()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const jwt = value.trim()
    if (!jwt) { setError('Please paste your JWT access token.'); return }
    if (!jwt.startsWith('eyJ')) { setError('Token does not look like a valid JWT (should start with eyJ…).'); return }
    setError('')
    login(jwt)
  }

  return (
    <div className="pg-login-wrap">
      <div className="pg-login-box">
        {/* Logo */}
        <div className="text-center mb-6">
          <div style={{ fontSize: '3rem', marginBottom: '0.3rem' }}>
            <i className="fas fa-dice-d20 dice-bounce" style={{ color: 'var(--color-gold-light)' }} />
          </div>
          <h1 style={{
            fontFamily: 'Cinzel Decorative, serif',
            fontSize: '1.5rem',
            color: 'var(--color-gold-light)',
            textShadow: '0 0 16px rgba(232,184,48,0.5)',
            letterSpacing: '0.06em',
          }}>
            Paths Games
          </h1>
          <p style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '0.65rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--color-ember)',
            marginTop: '0.2rem',
          }}>
            Admin Panel
          </p>
        </div>

        {/* Caption */}
        <p style={{ color: 'var(--color-ash)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          Paste your admin JWT access token to access the control panel.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Server selector */}
          <div className="mb-4">
            <label className="pg-label">
              <i className="fas fa-server me-1" />
              Backend Server
            </label>
            <select
              className="pg-input"
              value={server}
              onChange={e => changeServer(e.target.value)}
              style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}
            >
              {servers.map(s => (
                <option key={s.url} value={s.url}>{s.label} — {s.url}</option>
              ))}
            </select>
          </div>

          {/* Token field */}
          <div className="mb-4">
            <label className="pg-label">
              <i className="fas fa-key me-1" />
              JWT Access Token
            </label>
            <textarea
              className="pg-textarea"
              rows={4}
              placeholder="eyJhbGciOiJIUzI1NiJ9..."
              value={value}
              onChange={e => setValue(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <p style={{ color: 'var(--color-ash)', fontSize: '0.78rem', marginTop: '0.3rem' }}>
              <i className="fas fa-info-circle me-1" />
              Get a token by calling <code style={{ color: 'var(--color-gold-dark)' }}>POST /api/auth/guest</code> with an admin account.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="pg-alert pg-alert-danger mb-4">
              <i className="fas fa-exclamation-triangle me-2" />
              {error}
            </div>
          )}

          <button type="submit" className="pg-btn pg-btn-gold w-full justify-center" style={{ width: '100%', justifyContent: 'center' }}>
            <i className="fas fa-unlock-alt" />
            Enter Admin Panel
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.75rem', color: 'var(--color-stone)' }}>
          <i className="fas fa-shield-alt me-1" />
          Token is saved in localStorage — clear it to logout.
        </p>
      </div>
    </div>
  )
}

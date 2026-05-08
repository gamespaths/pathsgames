import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import { useServer, MOCK_SERVER } from '../../context/ServerContext'
import { getServerStatus } from '../../api/echoApi'

export default function Navbar() {
  const { lang, setLang, t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [guestToast, setGuestToast] = useState(false)
  const { server, servers, probing, changeServer } = useServer()
  const [status, setStatus] = useState('loading')  // 'online' | 'offline' | 'loading' | 'mock'
  const [version, setVersion] = useState('')

  useEffect(() => {
    let cancelled = false
    if (server === MOCK_SERVER) {
      setStatus('mock')
      setVersion('')
      return
    }
    setStatus('loading')
    setVersion('')
    getServerStatus(server)
      .then(data => {
        if (!cancelled) {
          setStatus('online')
          setVersion(data?.properties?.version || '')
        }
      })
      .catch(() => { if (!cancelled) setStatus('offline') })
    return () => { cancelled = true }
  }, [server])

  const isGamePage = location.pathname.startsWith('/play/')

  function handleGuestClick() {
    setGuestToast(true)
    setTimeout(() => setGuestToast(false), 3000)
  }

  return (
    <nav className="navbar-medieval">
      <a className="navbar-brand-pg" href="/">
        <i className="fas fa-dice-d20 navbar-dice" />
        <span className="navbar-brand-text">{t('nav.brand')}</span>
      </a>

      <div className="navbar-right">
        {/* Server selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(200,150,10,0.2)' }}>
          <i className="fas fa-server" style={{ color: 'var(--color-gold, #c8960a)', fontSize: '0.7rem' }} />
          {probing ? (
            <span style={{ color: 'var(--color-ash, #aaa)', fontSize: '0.65rem', fontFamily: 'Cinzel, serif' }}>detecting…</span>
          ) : (
            <select
              value={server}
              onChange={e => changeServer(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-gold-light, #e8c87a)', fontFamily: 'Cinzel, serif', fontSize: '0.68rem', outline: 'none', cursor: 'pointer' }}
            >
              {servers.map(s => (
                <option key={s.url} value={s.url} style={{ background: '#2e1508' }}>{s.label}</option>
              ))}
            </select>
          )}
          {status === 'mock' && <span style={{ color: '#888', fontSize: '0.65rem' }}>mock</span>}
          {status === 'online' && <span className="status-dot online" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4caf50', display: 'inline-block' }} />}
          {status === 'offline' && <span className="status-dot offline" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f44336', display: 'inline-block' }} />}
          {status === 'loading' && <span style={{ color: '#888', fontSize: '0.65rem' }}>…</span>}
          {version && <span style={{ color: '#888', fontSize: '0.6rem', fontFamily: 'Cinzel, serif' }}>{version}</span>}
        </div>

        {isGamePage && (
          <button className="btn-secondary-pg navbar-home-btn" onClick={() => navigate('/')}>
            <i className="fas fa-home me-1" />{t('game.exitToHome')}
          </button>
        )}

        <button
          className={`lang-btn ${lang === 'it' ? 'active' : ''}`}
          onClick={() => setLang('it')}
          title="Italiano"
        >
          IT
        </button>
        <button
          className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
          onClick={() => setLang('en')}
          title="English"
        >
          EN
        </button>

        <button className="nav-user-btn" title={t('nav.login')} onClick={handleGuestClick}>
          <i className="fas fa-user-circle" />
          <span>{t('nav.guest')}</span>
        </button>
      </div>

      {guestToast && (
        <div className="navbar-toast">
          <i className="fas fa-info-circle me-2" />
          {lang === 'it'
            ? '✦ Accesso non ancora disponibile — continui come ospite ✦'
            : '✦ Login not yet available — continuing as guest ✦'}
        </div>
      )}
    </nav>
  )
}

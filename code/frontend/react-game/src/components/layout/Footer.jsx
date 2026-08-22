import { useState, useEffect } from 'react'
import { useTranslation } from '../../i18n/context'
import { useServer } from '../../context/ServerContext'
import { getServerStatus } from '../../api/echoApi'

export default function Footer() {
  const { t } = useTranslation()
  const { server, servers, probing, changeServer } = useServer()
  const [status, setStatus] = useState('loading')
  const [version, setVersion] = useState('')

  useEffect(() => {
    let cancelled = false
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

  return (
    <footer className="medieval-footer">
      <div className="footer-inner">


        <div className="footer-copy  footer-alpha-warning">
          <i className="fas fa-flask" style={{ marginRight: '0.4rem', color: 'var(--color-gold, #c8960a)' }} />
          {t('footer.alpha')}
          <span className="footer-server-row">
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
            {status === 'online' &&<span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4caf50', display: 'inline-block', marginLeft: '0.3rem' }} />}
            {status === 'offline' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f44336', display: 'inline-block', marginLeft: '0.3rem' }} />}
            {status === 'loading' && <span style={{ color: '#888', fontSize: '0.65rem', marginLeft: '0.3rem' }}>…</span>}
            {version && <span style={{ color: '#888', fontSize: '0.6rem', fontFamily: 'Cinzel, serif', marginLeft: '0.3rem' }}>{version}</span>}
          </span>
        </div>


        <div className="footer-copy">
          <i className="fas fa-dice-d20 me-2" />
          <span className="gold-light">PATHS GAMES</span> 
          &nbsp; &copy; {t('footer.rights').toUpperCase()} 
          <br />
          v0.35.1 &nbsp;
          {t('footer.madeWith').toUpperCase()} <i className="fas fa-heart" /> {t('footer.byTeam').toUpperCase()}
        </div>

        <div className="footer-links-row">
          <a href="https://github.com/gamespaths/pathsgames" target="_blank" rel="noopener" className="footer-icon-link">
            <i className="fab fa-github" /><span>{t('footer.github')}</span>
          </a>
          <a href="https://github.com/gamespaths/pathsgames/blob/develop/documentation_v0/Roadmap.md" target="_blank" rel="noopener" 
                className="footer-icon-link d-none d-md-inline-flex">
            <i className="fas fa-newspaper" /><span>{t('footer.devlog')}</span>
          </a>
          <a href="https://www.instagram.com/pathsgames/" target="_blank" rel="noopener" className="footer-icon-link">
            <i className="fab fa-instagram" /><span>{t('footer.instagram')}</span>
          </a>
          <a href="https://www.youtube.com/channel/UCbrfVJJDmX-iBda6WhURPkQ" target="_blank" rel="noopener" className="footer-icon-link">
            <i className="fab fa-youtube" /><span>{t('footer.youtube')}</span>
          </a>
        </div>
        <div className="footer-copy footer-links-row">
          <a href="#" className="footer-icon-link" data-bs-toggle="modal" data-bs-target="#privacyPolicyModal">
            <i className="fas fa-shield-alt " /><span>{t('footer.privacy')}</span>
          </a>
          <a href="#" className="footer-icon-link" data-bs-toggle="modal" data-bs-target="#termsModal">
            <i className="fas fa-file-contract" /><span>{t('footer.terms')}</span>
          </a>
          <a href="#" className="footer-icon-link" data-bs-toggle="modal" data-bs-target="#cookiePolicyModal">
            <i className="fas fa-cookie-bite" /><span>{t('footer.cookies')}</span>
          </a>
          <a href="#" className="footer-icon-link" data-bs-toggle="modal" data-bs-target="#creditsModal" >
            <i className="fas fa-users" /><span>{t('footer.credits')}</span>
          </a>
        </div>



      </div>
    </footer>
  )
}

import { useTranslation } from '../../i18n/context'
import { useServer } from '../../context/ServerContext'
import { usePolicyBook } from '../../context/PolicyBookContext'
import { ENV_BADGE } from '../../constants/features'
import EnvBadge, { envBadgeLabel } from './EnvBadge'

export default function Footer() {
  const { t } = useTranslation()
  // v0.40.0 — status and version come from ServerContext (one request per server).
  const { server, servers, probing, status, version, changeServer } = useServer()
  const { openPolicyBook } = usePolicyBook()
  const policyLink = kind => e => { e.preventDefault(); openPolicyBook(kind) }

  return (
    <footer className="medieval-footer">
      <div className="footer-inner">


        <div className="footer-copy  footer-alpha-warning">
          <i className="fas fa-flask" style={{ marginRight: '0.4rem', color: 'var(--color-gold, #c8960a)' }} />
          {/* Step 40 — the build's env badge names the version; no badge (prod) → no sentence. */}
          {envBadgeLabel(ENV_BADGE, t) && <>{t('footer.alphaPrefix')}<EnvBadge /><br /></>}
          v0.40.0 &nbsp;
          {t('footer.madeWith').toUpperCase()} <i className="fas fa-heart" /> {t('footer.byTeam').toUpperCase()}
          <br />
          {t('footer.serversWarning')}
          <span className="footer-server-row">
            {/* Step 40 — same look as the rest of the footer: a "Server:" label, the name, the status */}
            <span className="footer-server-label">{t('footer.serverSelect')}: </span>
            {probing ? (
              <span className="footer-server-muted">detecting…</span>
            ) : servers.length <= 1 ? (
              // One server only (VITE_DEFAULT_SERVERS): its name, nothing to choose.
              <span className="footer-server-name">{servers[0]?.label ?? server}</span>
            ) : (
              <select className="footer-server-select" value={server} onChange={e => changeServer(e.target.value)}>
                {servers.map(s => (
                  <option key={s.url} value={s.url} style={{ background: '#2e1508' }}>{s.label}</option>
                ))}
              </select>
            )}
            {status === 'online' && <span className="footer-server-dot" style={{ background: '#4caf50' }} />}
            {status === 'offline' && <span className="footer-server-dot" style={{ background: '#f44336' }} />}
            {status === 'loading' && <span className="footer-server-muted ms-1">…</span>}
            {version && <span className="footer-server-muted ms-1">{version}</span>}
          </span>
        </div>


        <div className="footer-copy">
          <i className="fas fa-dice-d20 me-2" />
          <span className="gold-light">PATHS GAMES</span> 
          &nbsp; &copy; {t('footer.rights').toUpperCase()} 
        </div>

        <div className="footer-links-row">
          <a href="https://github.com/gamespaths/pathsgames" target="_blank" rel="noopener" className="footer-icon-link">
            <i className="fab fa-github" /><span>{t('footer.github')}</span>
          </a>
          {/* Step 40 — the Devlog opens the roadmap book (data/roadmap.json). */}
          <a href="#" className="footer-icon-link d-none d-md-inline-flex" onClick={policyLink('roadmap')}>
            <i className="fas fa-newspaper" /><span>{t('footer.devlog')}</span>
          </a>
          <a href="https://www.instagram.com/pathsgames/" target="_blank" rel="noopener" className="footer-icon-link footer-social-link">
            <i className="fab fa-instagram" /><span>{t('footer.instagram')}</span>
          </a>
          <a href="https://www.youtube.com/channel/UCbrfVJJDmX-iBda6WhURPkQ" target="_blank" rel="noopener" className="footer-icon-link footer-social-link">
            <i className="fab fa-youtube" /><span>{t('footer.youtube')}</span>
          </a>
        </div>
        <div className="footer-copy footer-links-row">
          <a href="#" className="footer-icon-link" onClick={policyLink('privacy')}>
            <i className="fas fa-shield-alt " /><span>{t('footer.privacy')}</span>
          </a>
          <a href="#" className="footer-icon-link" onClick={policyLink('terms')}>
            <i className="fas fa-file-contract" /><span>{t('footer.terms')}</span>
          </a>
          <a href="#" className="footer-icon-link" onClick={policyLink('cookies')}>
            <i className="fas fa-cookie-bite" /><span>{t('footer.cookies')}</span>
          </a>
          <a href="#" className="footer-icon-link" onClick={policyLink('credits')}>
            <i className="fas fa-users" /><span>{t('footer.credits')}</span>
          </a>
        </div>



      </div>
    </footer>
  )
}

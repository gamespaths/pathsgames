import { useTranslation } from '../../i18n/context'
import { useServer } from '../../context/ServerContext'
import { usePolicyBook } from '../../context/PolicyBookContext'
import EnvBadge from './EnvBadge'

/** The four policy links of row 2: kind and icon. */
const POLICY_LINKS = [
  ['privacy', 'fa-shield-alt'],
  ['terms', 'fa-file-contract'],
  ['cookies', 'fa-cookie-bite'],
  ['credits', 'fa-users'],
]

/** Row 1's server: a select (several) or a badge (green online, red offline, detecting); tooltip: the warning. */
export function FooterServer({ t, server, servers, probing, status, version, changeServer }) {
  const tip = t('footer.serversWarning')
  if (probing || (servers.length <= 1 && status === 'loading')) {
    return <span className="footer-server-row footer-server-muted" data-tip={tip}>{t('footer.serverDetecting')}</span>
  }
  if (servers.length > 1) {
    return (
      <span className="footer-server-row" data-tip={tip}>
        <select className="footer-server-select" aria-label={t('footer.serverSelect')} value={server}
          onChange={e => changeServer(e.target.value)}>
          {servers.map(s => (
            <option key={s.url} value={s.url} style={{ background: '#2e1508' }}>{s.label}</option>
          ))}
        </select>
        {status === 'online' && <span className="footer-server-dot footer-server-dot--online" />}
        {status === 'offline' && <span className="footer-server-dot footer-server-dot--offline" />}
        {status === 'loading' && <span className="footer-server-muted">…</span>}
        {version && <span className="footer-server-muted">{version}</span>}
      </span>
    )
  }
  if (status === 'offline') {
    return (
      <span className="footer-server-row footer-server-badge footer-server-badge--offline" data-tip={tip}>
        <i className="fas fa-server footer-server-icon" aria-hidden="true" />
        <span>{t('footer.serverOffline')}</span>
      </span>
    )
  }
  return (
    <span className="footer-server-row footer-server-badge footer-server-badge--online" data-tip={tip}>
      <i className="fas fa-server footer-server-icon" aria-hidden="true" />
      <span className="footer-server__full">{t('footer.serverVersion').replace('{version}', version ?? '').trim()}</span>
      <span className="footer-server__short">{version}</span>
    </span>
  )
}

/**
 * Footer — v1.13.0: a small bar after main, below the fold, two centred rows. Row 1: the env badge
 * (Devlog), the server, the copyright with the client version; row 2: the four policy chapters.
 */
export default function Footer() {
  const { t } = useTranslation()
  // v0.42.0 — status and version come from ServerContext (one request per server).
  const serverInfo = useServer()
  const { openPolicyBook } = usePolicyBook()

  return (
    <footer className="medieval-footer">
      <div className="footer-inner">
        <div className="footer-row footer-row--status">
          <EnvBadge variant="footer" />
          <FooterServer t={t} {...serverInfo} />
          <span className="footer-copy" data-testid="footer-copy">
            <i className="fas fa-dice-d20 me-1" />
            <span className="gold-light">PATHS GAMES</span>{' '}
            v1.14.0 &nbsp;
            &copy; {t('footer.rights').toUpperCase()}
          </span>
        </div>
        <div className="footer-row footer-row--links">
          {POLICY_LINKS.map(([kind, icon]) => (
            <button key={kind} type="button" className="footer-icon-link footer-link-btn"
              onClick={() => openPolicyBook(kind)}>
              <i className={`fas ${icon}`} aria-hidden="true" />
              <span className="footer-link__full">{t(`footer.${kind}`)}</span>
              <span className="footer-link__short">{t(`footer.short.${kind}`)}</span>
            </button>
          ))}
        </div>
      </div>
    </footer>
  )
}

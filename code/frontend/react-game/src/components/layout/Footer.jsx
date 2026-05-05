import { useTranslation } from '../../i18n/context'

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="medieval-footer">
      <div className="footer-inner">

        <div className="footer-links-row">

          <span className="footer-brand-sm">
            <i className="fas fa-dice-d20 me-1" />
            {' '}
            Paths Games
          </span>

          <a href="https://github.com/gamespaths/pathsgames" target="_blank" rel="noopener" className="footer-icon-link">
            <i className="fab fa-github" /><span>{t('footer.github')}</span>
          </a>
          <a href="https://github.com/gamespaths/pathsgames/blob/develop/documentation_v0/Roadmap.md" target="_blank" rel="noopener" className="footer-icon-link">
            <i className="fas fa-newspaper" /><span>{t('footer.devlog')}</span>
          </a>
          <a href="https://www.instagram.com/pathsgames/" target="_blank" rel="noopener" className="footer-icon-link">
            <i className="fab fa-instagram" /><span>{t('footer.instagram')}</span>
          </a>
          <a href="https://www.youtube.com/channel/UCbrfVJJDmX-iBda6WhURPkQ" target="_blank" rel="noopener" className="footer-icon-link">
            <i className="fab fa-youtube" /><span>{t('footer.youtube')}</span>
          </a>
        </div>

        <div className="footer-copy">
          <span className="gold-light">Paths Games v0.18.0</span> &copy; 2026 {t('footer.rights')} &middot;&nbsp;
          {t('footer.madeWith')} <i className="fas fa-heart" /> {t('footer.byTeam')} &middot;&nbsp;
          <a
            href="#"
            className="footer-link-inline"
            data-bs-toggle="modal"
            data-bs-target="#privacyPolicyModal"
          >
            {t('footer.privacy')}
          </a>
          &nbsp;&middot;&nbsp;
          <a
            href="#"
            className="footer-link-inline"
            data-bs-toggle="modal"
            data-bs-target="#termsModal"
          >
            {t('footer.terms')}
          </a>
          &nbsp;&middot;&nbsp;
          <a
            href="#"
            className="footer-link-inline"
            data-bs-toggle="modal"
            data-bs-target="#cookiePolicyModal"
          >
            {t('footer.cookies')}
          </a>
        </div>
      </div>
    </footer>
  )
}

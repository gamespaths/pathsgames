/* =============================================
   Footer — matches the html site footer exactly
   ============================================= */

import { useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faInstagram, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { faDiceD20, faScroll, faCoins, faNewspaper, faHeart } from '@fortawesome/free-solid-svg-icons';
import Modal from 'react-bootstrap/Modal';

export default function Footer() {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);

  const year = new Date().getFullYear();

  const handleExternal = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener');
  }, []);

  return (
    <footer className="medieval-footer" id="footer">
      <div className="footer-inner">
        {/* Brand */}
        <div className="footer-links-row">
          <span className="footer-brand-sm">
            <FontAwesomeIcon icon={faDiceD20} className="me-1" />
            Paths Games
          </span>
        </div>

        {/* Icon links row */}
        <div className="footer-links-row">
          <a
            href="https://github.com/gamespaths/pathsgames"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-icon-link"
            title="GitHub"
          >
            <FontAwesomeIcon icon={faGithub} /><span>GitHub</span>
          </a>
          <a
            href="https://github.com/gamespaths/pathsgames/blob/main/ROADMAP.md"
            className="footer-icon-link"
            title="Roadmap"
          >
            <FontAwesomeIcon icon={faScroll} /><span>Roadmap</span>
          </a>
          <button
            onClick={() => handleExternal('#crowdfund')}
            className="footer-icon-link footer-icon-btn"
            title="Crowdfunding"
          >
            <FontAwesomeIcon icon={faCoins} /><span>Crowdfunding</span>
          </button>
          <a
            href="https://github.com/gamespaths/pathsgames/blob/main/documentation_v0/Step00_Roadmap.md"
            className="footer-icon-link"
            title="Devlog"
          >
            <FontAwesomeIcon icon={faNewspaper} /><span>Devlog</span>
          </a>
          <a
            href="https://www.instagram.com/pathsgames/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-icon-link"
            title="Instagram"
          >
            <FontAwesomeIcon icon={faInstagram} /><span>Instagram</span>
          </a>
          <a
            href="https://www.youtube.com/channel/UCbrfVJJDmX-iBda6WhURPkQ"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-icon-link"
            title="YouTube"
          >
            <FontAwesomeIcon icon={faYoutube} /><span>YouTube</span>
          </a>
        </div>

        {/* Copyright */}
        <div className="footer-copy">
          <span className="gold-light">Paths Games v<span>0.14.0</span></span> &copy; {year} All rights reserved &middot;
          Crafted with <FontAwesomeIcon icon={faHeart} /> by the Paths Games Dev Team &middot;
          <button onClick={() => setShowPrivacy(true)} className="footer-link-inline">Privacy Policy</button> &middot;
          <button onClick={() => setShowTerms(true)} className="footer-link-inline">Terms of Service</button> &middot;
          <button onClick={() => setShowCopyright(true)} className="footer-link-inline">Copyright</button>
        </div>
      </div>

      {/* Privacy Modal */}
      <Modal show={showPrivacy} onHide={() => setShowPrivacy(false)} centered className="modal-medieval">
        <Modal.Header closeButton>
          <Modal.Title>Privacy Policy</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
            This Privacy Policy describes how <strong>Paths Games</strong> (&copy; paths.games) collects, uses and protects your personal information when you use our website and game services.
          </p>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
            We may collect basic usage data (page views, session duration) through anonymised analytics. No personal data is sold to third parties.
          </p>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
            For any privacy-related inquiries, contact us via our <a href="https://github.com/gamespaths/pathsgames" target="_blank" rel="noopener noreferrer">GitHub repository</a>.
          </p>
        </Modal.Body>
      </Modal>

      {/* Terms Modal */}
      <Modal show={showTerms} onHide={() => setShowTerms(false)} centered className="modal-medieval">
        <Modal.Header closeButton>
          <Modal.Title>Terms of Service</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
            By accessing and using <strong>Paths Games</strong> (&copy; paths.games) you agree to the following terms.
          </p>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
            <strong>Use of Content:</strong> All game content, stories, artwork and code are the intellectual property of Paths Games unless otherwise stated. Reproduction without permission is prohibited.
          </p>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
            <strong>User Conduct:</strong> You agree not to misuse the service, attempt unauthorised access, or violate any applicable laws.
          </p>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
            <strong>Disclaimer:</strong> The game is provided &quot;as-is&quot; during the development phase. Features may change without notice.
          </p>
        </Modal.Body>
      </Modal>

      {/* Copyright Modal */}
      <Modal show={showCopyright} onHide={() => setShowCopyright(false)} centered className="modal-medieval">
        <Modal.Header closeButton>
          <Modal.Title>Copyright Information</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '2.5rem' }}>&#9760;</p>
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
              All stories, artwork and game content are<br />
              <strong>&copy; paths.games {year}</strong><br />
              All rights reserved.
            </p>
            <p style={{ fontSize: '0.82rem', fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>
              Paths Games is an independent project. Redistribution or reproduction of any content without written permission is prohibited.
            </p>
          </div>
        </Modal.Body>
      </Modal>
    </footer>
  );
}

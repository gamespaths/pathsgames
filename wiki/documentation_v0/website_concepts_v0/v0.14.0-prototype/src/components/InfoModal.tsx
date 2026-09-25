/* =============================================
   InfoModal — copyright / terms info overlay
   Opens from the (i) icon on every card
   ============================================= */

import Modal from 'react-bootstrap/Modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useUI } from '../hooks/useUI';

export default function InfoModal() {
  const { state, dispatch } = useUI();
  const year = new Date().getFullYear();

  return (
    <Modal
      show={state.infoModalOpen}
      onHide={() => dispatch({ type: 'CLOSE_INFO_MODAL' })}
      centered
      className="modal-medieval"
    >
      <Modal.Header closeButton>
        <Modal.Title style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
          <FontAwesomeIcon icon={faInfoCircle} className="me-2" />
          Copyright Info
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '2.5rem' }}>&#9760;</p>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}>
          All stories, artwork and game content are<br />
          <strong>&copy; paths.games {year}</strong><br />
          All rights reserved.
        </p>
        <p style={{ fontSize: '0.82rem', fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>
          Paths Games is an independent project. Redistribution or reproduction
          of any content without written permission is prohibited.
        </p>
      </Modal.Body>

      <Modal.Footer className="justify-content-center">
        <button
          className="btn-medieval"
          onClick={() => dispatch({ type: 'CLOSE_INFO_MODAL' })}
        >
          <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
          Go Back
        </button>
      </Modal.Footer>
    </Modal>
  );
}

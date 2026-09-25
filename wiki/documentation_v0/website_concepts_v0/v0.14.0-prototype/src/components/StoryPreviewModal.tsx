/* =============================================
   StoryPreviewModal — multi-step wizard
   Steps: 0-2 (options), 3 (login), 4 (confirm)
   ============================================= */

import { useNavigate } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faScroll, faPlay, faArrowLeft, faCheckCircle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { useUI } from '../hooks/useUI';
import { useGame } from '../hooks/useGame';
import { STORY_OPTIONS, LOGIN_OPTIONS } from '../data/storyOptions';
import OptionStepComponent from './OptionStep';
import Card3D from './Card3D';

const TOTAL_STEPS = 5; // 0..4

export default function StoryPreviewModal() {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { dispatch: gameDispatch } = useGame();
  const navigate = useNavigate();

  const { storyPreviewOpen, previewStory, optionStep, termsAccepted } = uiState;

  if (!previewStory) return null;

  const handleClose = () => {
    uiDispatch({ type: 'CLOSE_STORY_PREVIEW' });
  };

  const goNext = () => {
    if (optionStep < TOTAL_STEPS - 1) {
      uiDispatch({ type: 'SET_OPTION_STEP', step: optionStep + 1 });
    }
  };

  const goBack = () => {
    if (optionStep > 0) {
      uiDispatch({ type: 'SET_OPTION_STEP', step: optionStep - 1 });
    }
  };

  const handleStartAdventure = () => {
    if (!termsAccepted) return;
    gameDispatch({ type: 'SET_ACTIVE_STORY', story: previewStory });
    gameDispatch({ type: 'START_GAME' });
    uiDispatch({ type: 'CLOSE_STORY_PREVIEW' });
    navigate(`/play/${previewStory.id}`);
  };

  const renderStep = () => {
    // Steps 0–2: Story Options (Difficulty, Character, Type)
    if (optionStep < 3) {
      return (
        <OptionStepComponent
          step={STORY_OPTIONS[optionStep]}
          onSelect={() => goNext()}
        />
      );
    }

    // Step 3: Login
    if (optionStep === 3) {
      return (
        <OptionStepComponent
          step={LOGIN_OPTIONS}
          onSelect={() => goNext()}
        />
      );
    }

    // Step 4: Confirm & Start — ToS card + Start card
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <h4 className="option-step-title text-center">
          <FontAwesomeIcon icon={faScroll} className="me-2" />
          Begin Your Adventure
        </h4>

        <div className="option-cards-row">
          {/* Terms of Service card */}
          <Card3D className={`card-medieval card-dimension-little flex-shrink-0 relative cursor-pointer ${termsAccepted ? 'card-selected' : ''}`}>
            <div
              className="card-medieval-header"
              style={{ minHeight: '80px' }}
              onClick={() => uiDispatch({ type: 'SET_TERMS_ACCEPTED', accepted: !termsAccepted })}
            >
              <FontAwesomeIcon
                icon={faScroll}
                className="text-3xl"
                style={{ color: termsAccepted ? 'var(--color-gold-shine)' : 'var(--color-gold-light)' }}
              />
            </div>
            <div className="card-medieval-title text-xs">Terms of Service</div>
            <div className="card-medieval-body flex justify-center">
              <button
                className={termsAccepted ? 'btn-medieval w-full text-xs' : 'btn-medieval-outline w-full text-xs'}
                onClick={() => uiDispatch({ type: 'SET_TERMS_ACCEPTED', accepted: !termsAccepted })}
              >
                <FontAwesomeIcon icon={faCheckCircle} className="me-1" />
                {termsAccepted ? 'Accepted' : 'Accept'}
              </button>
            </div>
          </Card3D>

          {/* Start Adventure card */}
          <Card3D className={`card-medieval card-dimension-little flex-shrink-0 relative ${!termsAccepted ? 'card-disabled-dim' : ''}`}>
            <div
              className="card-medieval-header"
              style={{ minHeight: '80px', cursor: termsAccepted ? 'pointer' : 'default' }}
              onClick={termsAccepted ? handleStartAdventure : undefined}
            >
              <FontAwesomeIcon
                icon={faPlay}
                className="text-3xl"
                style={{ color: termsAccepted ? 'var(--color-gold-shine)' : 'var(--color-ash)' }}
              />
            </div>
            <div className="card-medieval-title text-xs">Start Adventure</div>
            <div className="card-medieval-body flex justify-center">
              <button
                className="btn-medieval w-full text-xs"
                disabled={!termsAccepted}
                onClick={handleStartAdventure}
              >
                <FontAwesomeIcon icon={faPlay} className="me-1" />
                Start
              </button>
            </div>
          </Card3D>
        </div>
      </div>
    );
  };

  return (
    <Modal
      show={storyPreviewOpen}
      onHide={handleClose}
      size="lg"
      centered
      className="modal-medieval"
    >
      <Modal.Header closeButton>
        <Modal.Title style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
          {previewStory.emote} {previewStory.title}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div className="story-preview-layout">
          {/* Left: Large story card */}
          <div className="hidden md:block flex-shrink-0">
            <Card3D className="card-medieval card-dimension-large relative">
              <div className="card-medieval-header" style={{ minHeight: '200px' }}>
                <span className="card-emote">{previewStory.emote}</span>
              </div>
              <div className="card-medieval-title">{previewStory.title}</div>
              <div className="card-medieval-body">
                <p className="card-medieval-desc" style={{ WebkitLineClamp: 6 }}>
                  {previewStory.desc}
                </p>
              </div>
              {/* Info icon bottom-center */}
              <button
                className="card-info-btn card-info-btn-centered"
                title="Copyright info"
                onClick={(e) => { e.stopPropagation(); uiDispatch({ type: 'OPEN_INFO_MODAL' }); }}
              >
                <FontAwesomeIcon icon={faInfoCircle} />
              </button>
            </Card3D>
          </div>

          {/* Right: Options wizard */}
          <div className="story-preview-options">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-1 mb-2">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    background: i === optionStep ? 'var(--color-gold-light)' : 'var(--color-brown-mid)',
                    width: i === optionStep ? '2rem' : '0.5rem',
                  }}
                />
              ))}
            </div>

            {renderStep()}
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex justify-between w-full">
          <button
            className="btn-medieval-outline"
            onClick={goBack}
            disabled={optionStep === 0}
          >
            <i className="fas fa-arrow-left me-1" />
            Back
          </button>
          <button className="btn-medieval-outline" onClick={handleClose}>
            Cancel
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

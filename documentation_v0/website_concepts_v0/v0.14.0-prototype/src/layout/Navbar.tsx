/* =============================================
   Navbar — sticky top navigation bar
   Matches the html site header exactly
   ============================================= */

import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserCircle,
  faMapMarkedAlt,
  faBook,
  faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import BadgeCarousel from '../components/BadgeCarousel';
import { useGame } from '../hooks/useGame';
import { useUI } from '../hooks/useUI';

export default function Navbar() {
  const { state: gameState, dispatch: gameDispatch } = useGame();
  const { dispatch: uiDispatch } = useUI();
  const navigate = useNavigate();

  const handleStopGame = () => {
    gameDispatch({ type: 'STOP_GAME' });
    navigate('/');
  };

  const handleComingSoon = (feature: string) => {
    uiDispatch({ type: 'SHOW_CHOICE_POPUP', message: `${feature} — Coming Soon!` });
  };

  return (
    <>
      {/* Main Navbar */}
      <nav className="navbar-medieval">
        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <i className="fas fa-dice-d20 dice-bounce me-2" />
          <span>Paths Games</span>
        </Link>

        {/* Center: Badge Carousel (hidden on mobile) */}
        <div className="navbar-badges-to-rotate hidden md:flex">
          <BadgeCarousel />
        </div>

        {/* Right: Guest button */}
        <div className="nav-user">
          <button
            className="nav-user-btn"
            onClick={() => handleComingSoon('User accounts')}
            title="Login or continue as guest"
          >
            <FontAwesomeIcon icon={faUserCircle} />
            <span className="nav-user-label">Guest</span>
          </button>
        </div>
      </nav>

      {/* Game Bar — shown when playing */}
      {gameState.isPlaying && gameState.activeStory && (
        <div className="game-bar">
          <button
            className="game-bar-btn"
            onClick={handleStopGame}
          >
            <FontAwesomeIcon icon={faArrowLeft} className="me-1" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          <span className="game-bar-title">
            {gameState.activeStory.emote} {gameState.activeStory.title}
          </span>

          <button
            className="game-bar-btn"
            onClick={() => handleComingSoon('Map')}
            title="Map"
          >
            <FontAwesomeIcon icon={faMapMarkedAlt} className="me-1" />
            <span className="hidden sm:inline">Map</span>
          </button>

          <button
            className="game-bar-btn"
            onClick={() => handleComingSoon('Journal')}
            title="Journal"
          >
            <FontAwesomeIcon icon={faBook} className="me-1" />
            <span className="hidden sm:inline">Journal</span>
          </button>
        </div>
      )}
    </>
  );
}

/* =============================================
   PlayerBar — HP, Energy, Armor stats display
   ============================================= */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faBolt, faShieldAlt, faSuitcase } from '@fortawesome/free-solid-svg-icons';
import { useUI } from '../hooks/useUI';

export default function PlayerBar() {
  const { dispatch } = useUI();

  return (
    <div className="player-bar">
      {/* HP */}
      <div className="player-stat">
        <FontAwesomeIcon icon={faHeart} style={{ color: '#c44' }} />
        <span>HP</span>
        <div className="player-stat-bar">
          <div className="player-stat-fill" style={{ width: '80%', background: '#c44' }} />
        </div>
      </div>

      {/* Energy */}
      <div className="player-stat">
        <FontAwesomeIcon icon={faBolt} style={{ color: '#e8b830' }} />
        <span>Energy</span>
        <div className="player-stat-bar">
          <div className="player-stat-fill" style={{ width: '60%', background: '#e8b830' }} />
        </div>
      </div>

      {/* Armor */}
      <div className="player-stat">
        <FontAwesomeIcon icon={faShieldAlt} style={{ color: '#8b7355' }} />
        <span>Armor</span>
        <div className="player-stat-bar">
          <div className="player-stat-fill" style={{ width: '45%', background: '#8b7355' }} />
        </div>
      </div>

      {/* Inventory */}
      <button
        className="btn-medieval-outline flex items-center gap-1 text-xs ml-auto"
        onClick={() => dispatch({ type: 'SHOW_CHOICE_POPUP', message: 'Inventory — Coming Soon!' })}
      >
        <FontAwesomeIcon icon={faSuitcase} />
        <span className="hidden sm:inline">Inventory</span>
      </button>
    </div>
  );
}

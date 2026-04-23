/* =============================================
   NearbyLocations — horizontal row of go-cards
   ============================================= */

import type { Location, StoryLocations } from '../types';
import { useGame } from '../hooks/useGame';
import { useUI } from '../hooks/useUI';
import Card3D from './Card3D';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCompass, faWalking, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

interface NearbyLocationsProps {
  currentLocation: Location;
  allLocations: StoryLocations;
}

export default function NearbyLocations({ currentLocation, allLocations }: NearbyLocationsProps) {
  const { dispatch: gameDispatch } = useGame();
  const { dispatch: uiDispatch } = useUI();

  const handleGo = (locId: string) => {
    uiDispatch({ type: 'SET_SLIDE_DIRECTION', direction: 'right' });
    gameDispatch({ type: 'NAVIGATE_LOCATION', locationId: locId });
    setTimeout(() => uiDispatch({ type: 'SET_SLIDE_DIRECTION', direction: null }), 400);
  };

  const neighbors = currentLocation.neighbors
    .map((id) => allLocations[id])
    .filter(Boolean);

  if (neighbors.length === 0) return null;

  return (
    <div>
      <h4 className="game-scene-row-title">
        <FontAwesomeIcon icon={faCompass} className="me-2" />
        Nearby Locations
      </h4>
      <div className="game-scene-row">
        {neighbors.map((loc) => (
          <Card3D
            key={loc.id}
            className="card-medieval card-dimension-little flex-shrink-0 cursor-pointer relative"
          >
            <div
              className="card-medieval-header"
              style={{ minHeight: '70px' }}
              onClick={() => handleGo(loc.id)}
            >
              <span className="card-emote-small">{loc.emote}</span>
            </div>
            <div className="card-medieval-title text-xs">{loc.title}</div>
            <div className="card-medieval-body flex justify-center">
              <button
                className="btn-medieval w-full text-xs"
                onClick={() => handleGo(loc.id)}
              >
                <FontAwesomeIcon icon={faWalking} className="me-1" />
                Go
              </button>
            </div>

            {/* Info icon bottom-left */}
            <button
              className="card-info-btn"
              title="Copyright info"
              onClick={(e) => { e.stopPropagation(); uiDispatch({ type: 'OPEN_INFO_MODAL' }); }}
            >
              <FontAwesomeIcon icon={faInfoCircle} />
            </button>
          </Card3D>
        ))}
      </div>
    </div>
  );
}

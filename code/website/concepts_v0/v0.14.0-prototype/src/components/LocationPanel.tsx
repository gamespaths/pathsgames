/* =============================================
   LocationPanel — large location card display
   with slide transitions on navigation
   ============================================= */

import { useEffect, useState } from 'react';
import type { Location } from '../types';
import Card3D from './Card3D';
import { useUI } from '../hooks/useUI';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

interface LocationPanelProps {
  location: Location;
}

export default function LocationPanel({ location }: LocationPanelProps) {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const [animClass, setAnimClass] = useState('');

  useEffect(() => {
    if (uiState.slideDirection) {
      setAnimClass(uiState.slideDirection === 'left' ? 'slide-left' : 'slide-right');
      const timer = setTimeout(() => setAnimClass(''), 350);
      return () => clearTimeout(timer);
    }
  }, [uiState.slideDirection, location.id]);

  return (
    <div className={`game-scene-left ${animClass}`}>
      <Card3D className="location-card relative">
        {/* Emote */}
        <div className="card-medieval-header" style={{ minHeight: '200px' }}>
          <span className="card-emote" style={{ fontSize: '6rem' }}>
            {location.emote}
          </span>
        </div>

        {/* Title */}
        <div className="card-medieval-title" style={{ fontSize: '1rem' }}>
          {location.title}
        </div>

        {/* Description */}
        <div className="card-medieval-body">
          <p
            className="card-medieval-desc"
            style={{
              WebkitLineClamp: 6,
              fontSize: '0.9rem',
              lineHeight: '1.5',
            }}
          >
            {location.desc}
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
  );
}

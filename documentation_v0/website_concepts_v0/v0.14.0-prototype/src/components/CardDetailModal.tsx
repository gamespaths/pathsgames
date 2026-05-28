/* =============================================
   CardDetailModal — enlarged action/location card
   with Proceed button
   ============================================= */

import { useUI } from '../hooks/useUI';
import Card3D from './Card3D';
import type { Action } from '../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPlay, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

export default function CardDetailModal() {
  const { state, dispatch } = useUI();

  if (!state.cardDetailOpen || !state.cardDetailData) return null;

  const data = state.cardDetailData;
  const isAction = 'emote' in data && !('neighbors' in data);

  const handleClose = () => {
    dispatch({ type: 'CLOSE_CARD_DETAIL' });
  };

  const handleProceed = () => {
    dispatch({ type: 'CLOSE_CARD_DETAIL' });
    dispatch({ type: 'SHOW_CHOICE_POPUP', message: `${(data as Action).title} — Action result coming soon!` });
  };

  return (
    <div className="card-detail-overlay" onClick={handleClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative">
        {/* Close button */}
        <button className="card-detail-close" onClick={handleClose}>
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <Card3D className="location-card relative">
          {/* Emote */}
          <div className="card-medieval-header" style={{ minHeight: '200px' }}>
            <span className="card-emote" style={{ fontSize: '6rem' }}>
              {data.emote}
            </span>
          </div>

          {/* Title */}
          <div className="card-medieval-title" style={{ fontSize: '1rem' }}>
            {data.title}
          </div>

          {/* Description */}
          <div className="card-medieval-body flex flex-col gap-3">
            <p
              className="card-medieval-desc"
              style={{ WebkitLineClamp: 8, fontSize: '0.9rem', lineHeight: '1.5' }}
            >
              {data.desc}
            </p>

            {isAction && (
              <button className="btn-medieval w-full" onClick={handleProceed}>
                <FontAwesomeIcon icon={faPlay} className="me-1" />
                Proceed
              </button>
            )}
          </div>

          {/* Info icon bottom-center */}
          <button
            className="card-info-btn card-info-btn-centered"
            title="Copyright info"
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'OPEN_INFO_MODAL' }); }}
          >
            <FontAwesomeIcon icon={faInfoCircle} />
          </button>
        </Card3D>
      </div>
    </div>
  );
}

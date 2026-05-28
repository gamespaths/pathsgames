/* =============================================
   ActionCards — horizontal row of action cards
   ============================================= */

import type { Action } from '../types';
import { useUI } from '../hooks/useUI';
import Card3D from './Card3D';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandPointer } from '@fortawesome/free-solid-svg-icons';

interface ActionCardsProps {
  actions: Action[];
}

export default function ActionCards({ actions }: ActionCardsProps) {
  const { dispatch } = useUI();

  const handleAction = (action: Action) => {
    dispatch({ type: 'OPEN_CARD_DETAIL', data: action });
  };

  if (actions.length === 0) return null;

  return (
    <div>
      <h4 className="game-scene-row-title">
        <FontAwesomeIcon icon={faHandPointer} className="me-2" />
        Available Actions
      </h4>
      <div className="game-scene-row">
        {actions.map((action) => (
          <Card3D
            key={action.id}
            className="card-medieval card-dimension-little flex-shrink-0 cursor-pointer relative"
          >
            <div
              className="card-medieval-header"
              style={{ minHeight: '70px' }}
              onClick={() => handleAction(action)}
            >
              <span className="card-emote-small">{action.emote}</span>
            </div>
            <div className="card-medieval-title text-xs">{action.title}</div>
            <div className="card-medieval-body flex justify-center">
              <button
                className="btn-medieval w-full text-xs"
                onClick={() => handleAction(action)}
              >
                <FontAwesomeIcon icon={faHandPointer} className="me-1" />
                Act
              </button>
            </div>

          </Card3D>
        ))}
      </div>
    </div>
  );
}

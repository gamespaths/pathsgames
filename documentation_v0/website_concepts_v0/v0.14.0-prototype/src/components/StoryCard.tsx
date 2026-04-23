/* =============================================
   StoryCard — single card in the catalog row
   ============================================= */

import type { Story } from '../types';
import Card3D from './Card3D';
import { useUI } from '../hooks/useUI';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faPlay } from '@fortawesome/free-solid-svg-icons';

interface StoryCardProps {
  story: Story;
}

export default function StoryCard({ story }: StoryCardProps) {
  const { dispatch } = useUI();
  const playable = !!story.startLocation;

  const handlePlay = () => {
    if (playable) {
      dispatch({ type: 'OPEN_STORY_PREVIEW', story });
    } else {
      dispatch({ type: 'SHOW_CHOICE_POPUP', message: `${story.title} — Coming Soon!` });
    }
  };

  return (
    <Card3D className="card-medieval card-dimension-normal flex-shrink-0 relative">
      {/* Lock overlay for non-playable stories */}
      {!playable && (
        <div className="option-lock-overlay">
          <FontAwesomeIcon icon={faLock} className="option-lock-icon" />
          <span className="option-lock-text">Coming Soon</span>
        </div>
      )}

      {/* Header / Emote */}
      <div className="card-medieval-header" style={{ minHeight: '120px' }}>
        {story.cover ? (
          <img src={story.cover} alt={story.title} className="w-full h-full object-cover" />
        ) : (
          <span className="card-emote-small">{story.emote}</span>
        )}
      </div>

      {/* Title */}
      <div className="card-medieval-title">{story.title}</div>

      {/* Body */}
      <div className="card-medieval-body flex flex-col gap-2">
        <p className="card-medieval-desc">{story.desc}</p>

        {playable && (
          <button
            className="btn-medieval w-full mt-auto"
            onClick={handlePlay}
          >
            <FontAwesomeIcon icon={faPlay} className="me-1" /> Play
          </button>
        )}
      </div>

    </Card3D>
  );
}

/* =============================================
   GamePage — main game world view
   Location panel + nearby + actions
   ============================================= */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../hooks/useGame';
import { STORIES_LOCATIONS } from '../data/stories';
import PlayerBar from '../components/PlayerBar';
import LocationPanel from '../components/LocationPanel';
import NearbyLocations from '../components/NearbyLocations';
import ActionCards from '../components/ActionCards';
import CardDetailModal from '../components/CardDetailModal';

export default function GamePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { state } = useGame();
  const navigate = useNavigate();

  // Redirect to home if no active game
  useEffect(() => {
    if (!state.isPlaying || !state.activeStory) {
      navigate('/', { replace: true });
    }
  }, [state.isPlaying, state.activeStory, navigate]);

  if (!state.isPlaying || !state.activeStory || !state.currentLocationId || !storyId) {
    return null;
  }

  const locations = STORIES_LOCATIONS[storyId];
  if (!locations) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>
          Story "{storyId}" has no locations.
        </p>
      </div>
    );
  }

  const currentLocation = locations[state.currentLocationId];
  if (!currentLocation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>
          Location not found.
        </p>
      </div>
    );
  }

  return (
    <>
      <PlayerBar />

      <div className="game-scene">
        {/* Left: Location card */}
        <LocationPanel location={currentLocation} />

        {/* Right: Nearby + Actions */}
        <div className="game-scene-right">
          <NearbyLocations
            currentLocation={currentLocation}
            allLocations={locations}
          />
          <ActionCards actions={currentLocation.actions} />
        </div>
      </div>

      {/* Card Detail Modal overlay */}
      <CardDetailModal />
    </>
  );
}

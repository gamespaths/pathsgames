/* =============================================
   GameContext — game state management
   ============================================= */

import { createContext, useReducer, type ReactNode } from 'react';
import type { GameState, GameAction } from '../types';

const initialState: GameState = {
  activeStory: null,
  currentLocationId: null,
  navHistory: [],
  isPlaying: false,
  selectedOptions: {},
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_ACTIVE_STORY':
      return { ...state, activeStory: action.story };

    case 'START_GAME':
      return {
        ...state,
        isPlaying: true,
        currentLocationId: state.activeStory?.startLocation ?? null,
        navHistory: [],
      };

    case 'NAVIGATE_LOCATION':
      return {
        ...state,
        navHistory: state.currentLocationId
          ? [...state.navHistory, state.currentLocationId]
          : state.navHistory,
        currentLocationId: action.locationId,
      };

    case 'GO_BACK': {
      const history = [...state.navHistory];
      const prev = history.pop() ?? null;
      return {
        ...state,
        navHistory: history,
        currentLocationId: prev,
      };
    }

    case 'STOP_GAME':
      return {
        ...initialState,
      };

    case 'SET_OPTION':
      return {
        ...state,
        selectedOptions: { ...state.selectedOptions, [action.key]: action.value },
      };

    default:
      return state;
  }
}

export const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}>({
  state: initialState,
  dispatch: () => undefined,
});

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

/* =============================================
   UIContext — UI state management
   ============================================= */

import { createContext, useReducer, type ReactNode } from 'react';
import type { UIState, UIAction } from '../types';

const initialState: UIState = {
  storyPreviewOpen: false,
  previewStory: null,
  optionStep: 0,
  cardDetailOpen: false,
  cardDetailData: null,
  choicePopup: null,
  slideDirection: null,
  termsAccepted: false,
  infoModalOpen: false,
  infoModalOpen: false,
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'OPEN_STORY_PREVIEW':
      return {
        ...state,
        storyPreviewOpen: true,
        previewStory: action.story,
        optionStep: 0,
        termsAccepted: false,
      };

    case 'CLOSE_STORY_PREVIEW':
      return {
        ...state,
        storyPreviewOpen: false,
        previewStory: null,
        optionStep: 0,
        termsAccepted: false,
      };

    case 'SET_OPTION_STEP':
      return { ...state, optionStep: action.step };

    case 'OPEN_CARD_DETAIL':
      return { ...state, cardDetailOpen: true, cardDetailData: action.data };

    case 'CLOSE_CARD_DETAIL':
      return { ...state, cardDetailOpen: false, cardDetailData: null };

    case 'SHOW_CHOICE_POPUP':
      return { ...state, choicePopup: action.message };

    case 'HIDE_CHOICE_POPUP':
      return { ...state, choicePopup: null };

    case 'SET_SLIDE_DIRECTION':
      return { ...state, slideDirection: action.direction };

    case 'SET_TERMS_ACCEPTED':
      return { ...state, termsAccepted: action.accepted };

    case 'OPEN_INFO_MODAL':
      return { ...state, infoModalOpen: true };

    case 'CLOSE_INFO_MODAL':
      return { ...state, infoModalOpen: false };

    case 'RESET_OPTIONS':
      return { ...state, optionStep: 0, termsAccepted: false };

    default:
      return state;
  }
}

export const UIContext = createContext<{
  state: UIState;
  dispatch: React.Dispatch<UIAction>;
}>({
  state: initialState,
  dispatch: () => undefined,
});

export function UIProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, initialState);
  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  );
}

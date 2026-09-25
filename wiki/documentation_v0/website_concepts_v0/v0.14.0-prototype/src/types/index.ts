/* =============================================
   PATHS GAMES — TypeScript type definitions
   ============================================= */

/** A single action available at a location */
export interface Action {
  id: string;
  icon: string;
  emote: string;
  title: string;
  desc: string;
}

/** A game world location within a story */
export interface Location {
  id: string;
  title: string;
  icon: string;
  iconColor: string | null;
  emote: string;
  image: string | null;
  desc: string;
  neighbors: string[];
  actions: Action[];
}

/** A story in the catalog */
export interface Story {
  id: string;
  title: string;
  category: string;
  emote: string;
  cover: string | null;
  desc: string;
  startLocation: string | null;
}

/** Map of locationId → Location for a single story */
export type StoryLocations = Record<string, Location>;

/** Map of storyId → StoryLocations */
export type AllStoryLocations = Record<string, StoryLocations>;

/** A single option value (e.g. "Easy", "Hard") */
export interface OptionValue {
  label: string;
  icon: string;
  disabled: boolean;
}

/** One step in the story-preview options flow */
export interface OptionStep {
  option: string;
  icon: string;
  values: OptionValue[];
}

/* ── Game State ── */

export interface GameState {
  activeStory: Story | null;
  currentLocationId: string | null;
  navHistory: string[];
  isPlaying: boolean;
  selectedOptions: Record<string, string>;
}

export type GameAction =
  | { type: 'SET_ACTIVE_STORY'; story: Story }
  | { type: 'START_GAME' }
  | { type: 'NAVIGATE_LOCATION'; locationId: string }
  | { type: 'GO_BACK' }
  | { type: 'STOP_GAME' }
  | { type: 'SET_OPTION'; key: string; value: string };

/* ── UI State ── */

export type SlideDirection = 'left' | 'right' | null;

export interface UIState {
  storyPreviewOpen: boolean;
  previewStory: Story | null;
  optionStep: number;
  cardDetailOpen: boolean;
  cardDetailData: Action | Location | null;
  choicePopup: string | null;
  slideDirection: SlideDirection;
  termsAccepted: boolean;
  infoModalOpen: boolean;
}

export type UIAction =
  | { type: 'OPEN_STORY_PREVIEW'; story: Story }
  | { type: 'CLOSE_STORY_PREVIEW' }
  | { type: 'SET_OPTION_STEP'; step: number }
  | { type: 'OPEN_CARD_DETAIL'; data: Action | Location }
  | { type: 'CLOSE_CARD_DETAIL' }
  | { type: 'SHOW_CHOICE_POPUP'; message: string }
  | { type: 'HIDE_CHOICE_POPUP' }
  | { type: 'SET_SLIDE_DIRECTION'; direction: SlideDirection }
  | { type: 'SET_TERMS_ACCEPTED'; accepted: boolean }
  | { type: 'OPEN_INFO_MODAL' }
  | { type: 'CLOSE_INFO_MODAL' }
  | { type: 'RESET_OPTIONS' };

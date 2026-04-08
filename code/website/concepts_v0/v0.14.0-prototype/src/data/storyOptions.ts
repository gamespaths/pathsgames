/* =============================================
   PATHS GAMES — storyOptions.ts
   Multi-step option flow for story preview
   Ported from main.js STORY_OPTIONS
   ============================================= */

import type { OptionStep } from '../types';

export const STORY_OPTIONS: OptionStep[] = [
  {
    option: 'Difficulty',
    icon: 'fas fa-skull-crossbones',
    values: [
      { label: 'Easy', icon: 'fas fa-feather', disabled: false },
      { label: 'Medium', icon: 'fas fa-shield-alt', disabled: true },
      { label: 'Hard', icon: 'fas fa-skull-crossbones', disabled: true },
    ],
  },
  {
    option: 'Character',
    icon: 'fas fa-user',
    values: [
      { label: 'Hero', icon: 'fas fa-crown', disabled: false },
      { label: 'Evil', icon: 'fas fa-skull', disabled: true },
      { label: 'Poor', icon: 'fas fa-hat-wizard', disabled: true },
    ],
  },
  {
    option: 'Type',
    icon: 'fas fa-gamepad',
    values: [
      { label: 'Single Player', icon: 'fas fa-user', disabled: false },
      { label: 'Multiplayer', icon: 'fas fa-users', disabled: true },
      { label: 'Open World', icon: 'fas fa-globe', disabled: true },
    ],
  },
];

/** Login options (step 3) */
export const LOGIN_OPTIONS: OptionStep = {
  option: 'Login',
  icon: 'fas fa-sign-in-alt',
  values: [
    { label: 'Guest', icon: 'fas fa-mask', disabled: false },
    { label: 'Register', icon: 'fas fa-user-plus', disabled: true },
    { label: 'Login', icon: 'fas fa-sign-in-alt', disabled: true },
  ],
};

/* =============================================
   PATHS GAMES — stories.ts
   Story catalog + world locations data
   Ported from stories.js
   ============================================= */

import type { Story, AllStoryLocations } from '../types';

export const STORIES: Story[] = [
  {
    id: 'ironspire',
    title: 'Ironspire Castle',
    category: 'Fantasy',
    emote: '🏰',
    cover: null,
    desc: "A fallen king's fortress full of forgotten halls and dark dungeons. Your choices forge the path ahead.",
    startLocation: 'castle',
  },
  {
    id: 'frost_peaks',
    title: 'Frost Peaks',
    category: 'Fantasy',
    emote: '⛰️',
    cover: null,
    desc: 'Treacherous mountain passes shrouded in eternal snow. Ancient dangers slumber beneath the ice.',
    startLocation: null,
  },
  {
    id: 'ember_abyss',
    title: 'The Ember Abyss',
    category: 'Fantasy',
    emote: '🐉',
    cover: null,
    desc: 'Face the great dragon Vaelthorax in the heart of the mountain. Will you fight, talk, or flee?',
    startLocation: null,
  },
  {
    id: 'silver_coast',
    title: 'The Silver Coast',
    category: 'Adventure',
    emote: '⛵',
    cover: null,
    desc: 'Pirate lords fight for control of the trade routes. You must navigate alliances and betrayals.',
    startLocation: null,
  },
  {
    id: 'lost_caravan',
    title: 'The Lost Caravan',
    category: 'Adventure',
    emote: '🐪',
    cover: null,
    desc: 'A merchant caravan vanishes in the desert. Follow the trail through sand-storms and mirages.',
    startLocation: null,
  },
  {
    id: 'shadow_plague',
    title: 'The Shadow Plague',
    category: 'Adventure',
    emote: '🧟',
    cover: null,
    desc: 'A mysterious illness turns villagers into hollow husks. Uncover the source before nightfall.',
    startLocation: null,
  },
  {
    id: 'crimson_manor',
    title: 'Crimson Manor',
    category: 'Adventure',
    emote: '🏚️',
    cover: null,
    desc: 'An old aristocratic mansion where paintings whisper and halls rearrange themselves at will.',
    startLocation: null,
  },
];

export const STORIES_LOCATIONS: AllStoryLocations = {
  ironspire: {
    castle: {
      id: 'castle',
      title: 'Ironspire Castle',
      icon: 'fas fa-chess-rook',
      iconColor: null,
      emote: '🏰',
      image: null,
      desc: 'The ancient seat of the fallen king. Torchlight flickers in forgotten halls where echoes speak louder than the living.',
      neighbors: ['dungeon', 'mountains'],
      actions: [
        { id: 'search', icon: 'fas fa-search', emote: '🔍', title: 'Search the Hall', desc: 'Sift through shadows for forgotten relics.' },
        { id: 'rest', icon: 'fas fa-bed', emote: '💤', title: 'Rest by the Fire', desc: 'Recover your strength at the cold hearth.' },
        { id: 'pray', icon: 'fas fa-praying-hands', emote: '🕯️', title: 'Pray at the Altar', desc: 'Seek guidance from the spirits of the fallen.' },
      ],
    },
    dungeon: {
      id: 'dungeon',
      title: 'Castle Dungeon',
      icon: 'fas fa-dungeon',
      iconColor: '#9a6f08',
      emote: '🗝️',
      image: null,
      desc: 'Dripping stone walls and rusted chains. Something moves in the shadows beyond the last torch.',
      neighbors: ['castle'],
      actions: [
        { id: 'open_cell', icon: 'fas fa-key', emote: '🔑', title: 'Open a Cell', desc: 'One of the cells is not fully locked.' },
        { id: 'inspect_walls', icon: 'fas fa-eye', emote: '👁️', title: 'Inspect the Walls', desc: 'Old inscriptions are carved deep in stone.' },
        { id: 'listen', icon: 'fas fa-assistive-listening-systems', emote: '👂', title: 'Listen in Silence', desc: 'Something stirs beyond the last torch.' },
      ],
    },
    mountains: {
      id: 'mountains',
      title: 'Frost Mountains',
      icon: 'fas fa-mountain',
      iconColor: null,
      emote: '⛰️',
      image: null,
      desc: 'Treacherous passes through eternal snow. The wind carries whispers of something ancient sleeping beneath the glacier.',
      neighbors: ['castle', 'wolf_camp', 'dragon'],
      actions: [
        { id: 'gather', icon: 'fas fa-leaf', emote: '🌿', title: 'Gather Herbs', desc: 'Rare plants cling to the frozen cliffs.' },
        { id: 'scout', icon: 'fas fa-binoculars', emote: '🔭', title: 'Scout Ahead', desc: 'Assess the passes before the storm hits.' },
        { id: 'camp', icon: 'fas fa-fire', emote: '🔥', title: 'Set Up Camp', desc: 'Rest before the treacherous descent.' },
      ],
    },
    wolf_camp: {
      id: 'wolf_camp',
      title: 'Wolf Territory',
      icon: 'fas fa-paw',
      iconColor: '#c08040',
      emote: '🐺',
      image: null,
      desc: 'A circle of bones and fresh tracks in the snow. The wolves are close — and they know you are here.',
      neighbors: ['mountains'],
      actions: [
        { id: 'track', icon: 'fas fa-shoe-prints', emote: '👣', title: 'Track the Pack', desc: 'Follow pawprints deeper into the snow.' },
        { id: 'set_trap', icon: 'fas fa-cog', emote: '🪤', title: 'Set a Trap', desc: 'Lay a snare before nightfall comes.' },
        { id: 'fight', icon: 'fas fa-fist-raised', emote: '⚔️', title: 'Stand and Fight', desc: 'Draw your blade and face the pack.' },
      ],
    },
    dragon: {
      id: 'dragon',
      title: 'The Ember Abyss',
      icon: 'fas fa-dragon',
      iconColor: '#d44a0a',
      emote: '🐉',
      image: null,
      desc: 'The great dragon Vaelthorax rests atop centuries of plunder. Every heartbeat shakes the stone.',
      neighbors: ['mountains'],
      actions: [
        { id: 'speak', icon: 'fas fa-comments', emote: '🗣️', title: 'Speak to the Dragon', desc: 'Seek wisdom in the ancient flame.' },
        { id: 'attack', icon: 'fas fa-fist-raised', emote: '⚔️', title: 'Attack the Dragon', desc: "Steel against scales — a fool's gambit." },
        { id: 'flee', icon: 'fas fa-running', emote: '🏃', title: 'Flee Back', desc: 'Better to run than burn.' },
      ],
    },
  },
};

/* =============================================
   PATHS GAMES — v0.15.0-prototype — stories.js
   Static data for locations, actions, and choices.
   These are NOT yet available via the Story Content API
   (Step 14/15 only provides story metadata, categories,
   groups, difficulties, character templates, classes, traits).
   
   This file provides:
     1. STORIES_LOCATIONS — full location/action/choice data per story
     2. LOCAL_STORY_CONFIG — local UI config (emote, startLocation)
        mapped by story UUID from the backend.
   
   When the API adds location/event/choice endpoints, this
   file can be removed entirely.
   ============================================= */

/* ══════════════════════════════════════════
   LOCAL STORY CONFIG
   Maps backend story UUIDs to local UI data
   (emotes, start locations, playability).
   
   Update these UUIDs to match your backend's
   actual story UUIDs after import.
   ══════════════════════════════════════════ */
var LOCAL_STORY_CONFIG = {

  /* ─── Fallback matching by title (case-insensitive) ─── 
     When API stories are loaded, we match by title to find
     the local config. This avoids hardcoding UUIDs. */

  '_by_title': {
    'ironspire castle': {
      localId: 'ironspire',
      emote: '🏰',
      startLocation: 'castle'
    },
    'frost peaks': {
      localId: 'frost_peaks',
      emote: '⛰️',
      startLocation: null
    },
    'the ember abyss': {
      localId: 'ember_abyss',
      emote: '🐉',
      startLocation: null
    },
    'the silver coast': {
      localId: 'silver_coast',
      emote: '⛵',
      startLocation: null
    },
    'the lost caravan': {
      localId: 'lost_caravan',
      emote: '🐪',
      startLocation: null
    },
    'the shadow plague': {
      localId: 'shadow_plague',
      emote: '🧟',
      startLocation: null
    },
    'crimson manor': {
      localId: 'crimson_manor',
      emote: '🏚️',
      startLocation: null
    }
  },

  /* ─── Default config for unknown stories from API ─── */
  '_default': {
    emote: '📜',
    startLocation: null
  }
};


/* ══════════════════════════════════════════
   FALLBACK STORIES
   Used when the API is unreachable.
   Same format as the original stories.js STORIES array.
   ══════════════════════════════════════════ */
var FALLBACK_STORIES = [
  {
    id: 'ironspire',
    title: 'Ironspire Castle',
    category: 'Fantasy',
    emote: '🏰',
    cover: null,
    desc: 'A fallen king\'s fortress full of forgotten halls and dark dungeons. Your choices forge the path ahead.',
    startLocation: 'castle'
  },
  {
    id: 'frost_peaks',
    title: 'Frost Peaks',
    category: 'Fantasy',
    emote: '⛰️',
    cover: null,
    desc: 'Treacherous mountain passes shrouded in eternal snow. Ancient dangers slumber beneath the ice.',
    startLocation: null
  },
  {
    id: 'ember_abyss',
    title: 'The Ember Abyss',
    category: 'Fantasy',
    emote: '🐉',
    cover: null,
    desc: 'Face the great dragon Vaelthorax in the heart of the mountain. Will you fight, talk, or flee?',
    startLocation: null
  },
  {
    id: 'silver_coast',
    title: 'The Silver Coast',
    category: 'Adventure',
    emote: '⛵',
    cover: null,
    desc: 'Pirate lords fight for control of the trade routes. You must navigate alliances and betrayals.',
    startLocation: null
  },
  {
    id: 'lost_caravan',
    title: 'The Lost Caravan',
    category: 'Adventure',
    emote: '🐪',
    cover: null,
    desc: 'A merchant caravan vanishes in the desert. Follow the trail through sand-storms and mirages.',
    startLocation: null
  },
  {
    id: 'shadow_plague',
    title: 'The Shadow Plague',
    category: 'Adventure',
    emote: '🧟',
    cover: null,
    desc: 'A mysterious illness turns villagers into hollow husks. Uncover the source before nightfall.',
    startLocation: null
  },
  {
    id: 'crimson_manor',
    title: 'Crimson Manor',
    category: 'Adventure',
    emote: '🏚️',
    cover: null,
    desc: 'An old aristocratic mansion where paintings whisper and halls rearrange themselves at will.',
    startLocation: null
  }
];


/* ══════════════════════════════════════════
   WORLD DATA — locations per story
   STORIES_LOCATIONS[localId][locationId]
   
   This is the game world data: locations, neighbors,
   and available actions. The API does not yet provide
   these (future steps will add location/event/choice
   endpoints). For now, this static data drives gameplay.
   ══════════════════════════════════════════ */
var STORIES_LOCATIONS = {

  /* ─── IRONSPIRE CASTLE ─────────────────── */
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
        { id: 'search',  icon: 'fas fa-search',         emote: '🔍', title: 'Search the Hall',   desc: 'Sift through shadows for forgotten relics.' },
        { id: 'rest',    icon: 'fas fa-bed',             emote: '💤', title: 'Rest by the Fire',  desc: 'Recover your strength at the cold hearth.' },
        { id: 'pray',    icon: 'fas fa-praying-hands',   emote: '🕯️', title: 'Pray at the Altar', desc: 'Seek guidance from the spirits of the fallen.' }
      ]
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
        { id: 'open_cell',     icon: 'fas fa-key',           emote: '🔑', title: 'Open a Cell',        desc: 'One of the cells is not fully locked.' },
        { id: 'inspect_walls', icon: 'fas fa-eye',           emote: '👁️', title: 'Inspect the Walls',  desc: 'Old inscriptions are carved deep in stone.' },
        { id: 'listen',        icon: 'fas fa-assistive-listening-systems', emote: '👂', title: 'Listen in Silence', desc: 'Something stirs beyond the last torch.' }
      ]
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
        { id: 'gather', icon: 'fas fa-leaf',        emote: '🌿', title: 'Gather Herbs',  desc: 'Rare plants cling to the frozen cliffs.' },
        { id: 'scout',  icon: 'fas fa-binoculars',  emote: '🔭', title: 'Scout Ahead',   desc: 'Assess the passes before the storm hits.' },
        { id: 'camp',   icon: 'fas fa-fire',        emote: '🔥', title: 'Set Up Camp',   desc: 'Rest before the treacherous descent.' }
      ]
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
        { id: 'track',    icon: 'fas fa-shoe-prints',  emote: '👣', title: 'Track the Pack',   desc: 'Follow pawprints deeper into the snow.' },
        { id: 'set_trap', icon: 'fas fa-cog',           emote: '🪤', title: 'Set a Trap',       desc: 'Lay a snare before nightfall comes.' },
        { id: 'fight',    icon: 'fas fa-fist-raised',   emote: '⚔️', title: 'Stand and Fight',  desc: 'Draw your blade and face the pack.' }
      ]
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
        { id: 'speak',  icon: 'fas fa-comments',     emote: '🗣️', title: 'Speak to the Dragon', desc: 'Seek wisdom in the ancient flame.' },
        { id: 'attack', icon: 'fas fa-fist-raised',  emote: '⚔️', title: 'Attack the Dragon',   desc: 'Steel against scales — a fool\'s gambit.' },
        { id: 'flee',   icon: 'fas fa-running',      emote: '🏃', title: 'Flee Back',            desc: 'Better to run than burn.' }
      ]
    }

  }
  /* ─── Add new stories below ─────────────────
  ,
  another_story_local_id: {
    location1: { id: 'location1', ... }
  }
  ──────────────────────────────────────────── */
};

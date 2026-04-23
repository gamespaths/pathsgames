/* =============================================
   PATHS GAMES — stories.js  (v0.16.3-prototype-api)
   Game world data — locations per story UUID.
   STORIES_LOCATIONS[storyUuid][locationId]
   Only playable stories appear here; the catalog
   is now API-driven (see main.js / mock-data.js).
   All images from Unsplash with artist credits.
   ============================================= */

/* ══════════════════════════════════════════
   WORLD DATA — locations per story UUID
   ══════════════════════════════════════════ */
var STORIES_LOCATIONS = {

  /* ─── TUTORIAL — Ironspire Castle ──────── */
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d': {

    castle: {
      id: 'castle',
      title: 'Ironspire Castle',
      icon: 'fas fa-chess-rook',
      iconColor: null,
      emote: '🏰',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&fit=crop&q=80',
      imageCredit: { artist: 'Dima Pechurin', url: 'https://unsplash.com/photos/low-angle-photography-of-castle-under-white-clouds-O6VvT8f8kXs' },
      desc: 'The ancient seat of the fallen king. Torchlight flickers in forgotten halls where echoes speak louder than the living.',
      neighbors: ['dungeon', 'mountains'],
      actions: [
        {
          id: 'search', icon: 'fas fa-search', emote: '🔍',
          title: 'Search the Hall', desc: 'Sift through shadows for forgotten relics.',
          image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Alfons Morales', url: 'https://unsplash.com/photos/books-on-shelf-YL_7yZ9h9_c' }
        },
        {
          id: 'rest', icon: 'fas fa-bed', emote: '💤',
          title: 'Rest by the Fire', desc: 'Recover your strength at the cold hearth.',
          image: 'https://images.unsplash.com/photo-1473286835901-04adb1afab03?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Claudio Testeni', url: 'https://unsplash.com/photos/bonfire-during-nighttime-QZ5b_iA9N8' }
        },
        {
          id: 'pray', icon: 'fas fa-praying-hands', emote: '🕯️',
          title: 'Pray at the Altar', desc: 'Seek guidance from the spirits of the fallen.',
          image: 'https://images.unsplash.com/photo-1548625313-107755ba0c40?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Aliaksandr Antanovich', url: 'https://unsplash.com/photos/low-angle-view-of-statue-against-sky- during-daytime-O6VvT8f8kXs' }
        }
      ]
    },

    dungeon: {
      id: 'dungeon',
      title: 'Castle Dungeon',
      icon: 'fas fa-dungeon',
      iconColor: '#9a6f08',
      emote: '🗝️',
      image: 'https://images.unsplash.com/photo-1525874684015-58379d421a52?w=600&fit=crop&q=80',
      imageCredit: { artist: 'Umberto', url: 'https://unsplash.com/photos/brown-brick-archway-during-daytime-O6VvT8f8kXs' },
      desc: 'Dripping stone walls and rusted chains. Something moves in the shadows beyond the last torch.',
      neighbors: ['castle'],
      actions: [
        {
          id: 'open_cell', icon: 'fas fa-key', emote: '🔑',
          title: 'Open a Cell', desc: 'One of the cells is not fully locked.',
          image: 'https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Jonas Stolle', url: 'https://unsplash.com/photos/low-angle-view-of-spiral-staircase-7_V0M2p5ZpE' }
        },
        {
          id: 'inspect_walls', icon: 'fas fa-eye', emote: '👁️',
          title: 'Inspect the Walls', desc: 'Old inscriptions are carved deep in stone.',
          image: 'https://images.unsplash.com/photo-1543236359-57ef9a3fd647?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Milos Prelevic', url: 'https://unsplash.com/photos/gray-concrete-wall-O6VvT8f8kXs' }
        },
        {
          id: 'listen', icon: 'fas fa-assistive-listening-systems', emote: '👂',
          title: 'Listen in Silence', desc: 'Something stirs beyond the last torch.',
          image: 'https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Jay Mantri', url: 'https://unsplash.com/photos/photo-of-mountain-O6VvT8f8kXs' }
        }
      ]
    },

    mountains: {
      id: 'mountains',
      title: 'Frost Mountains',
      icon: 'fas fa-mountain',
      iconColor: null,
      emote: '⛰️',
      image: 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=600&fit=crop&q=80',
      imageCredit: { artist: 'Slyvain Mauroux', url: 'https://unsplash.com/photos/mountain-peaks-during-golden-hour-B_S_6Br_M38' },
      desc: 'Treacherous passes through eternal snow. The wind carries whispers of something ancient sleeping beneath the glacier.',
      neighbors: ['castle', 'wolf_camp', 'dragon'],
      actions: [
        {
          id: 'gather', icon: 'fas fa-leaf', emote: '🌿',
          title: 'Gather Herbs', desc: 'Rare plants cling to the frozen cliffs.',
          image: 'https://images.unsplash.com/photo-1502444330042-d1a1ddf9ca5c?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Vinit Vispute', url: 'https://unsplash.com/photos/people-sitting-on-ground-near-mountain-during-daytime-O6VvT8f8kXs' }
        },
        {
          id: 'scout', icon: 'fas fa-binoculars', emote: '🔭',
          title: 'Scout Ahead', desc: 'Assess the passes before the storm hits.',
          image: 'https://images.unsplash.com/photo-1510942201312-84e7962f6dbb?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Fabio Comparelli', url: 'https://unsplash.com/photos/brown-cave-under-blue-sky-during-daytime-p_S_d_6P_Uo' }
        },
        {
          id: 'camp', icon: 'fas fa-fire', emote: '🔥',
          title: 'Set Up Camp', desc: 'Rest before the treacherous descent.',
          image: 'https://images.unsplash.com/photo-1506535772-45244ca3a215?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Dominik J.P.', url: 'https://unsplash.com/photos/campfire-on-grass-field-during-daytime-O6VvT8f8kXs' }
        }
      ]
    },

    wolf_camp: {
      id: 'wolf_camp',
      title: 'Wolf Territory',
      icon: 'fas fa-paw',
      iconColor: '#c08040',
      emote: '🐺',
      image: 'https://images.unsplash.com/photo-1590422402120-72da49302521?w=600&fit=crop&q=80',
      imageCredit: { artist: 'Yannick Menard', url: 'https://unsplash.com/photos/gray-wolf-on-brown-grass-during-daytime-O6VvT8f8kXs' },
      desc: 'A circle of bones and fresh tracks in the snow. The wolves are close — and they know you are here.',
      neighbors: ['mountains'],
      actions: [
        {
          id: 'track', icon: 'fas fa-shoe-prints', emote: '👣',
          title: 'Track the Pack', desc: 'Follow pawprints deeper into the snow.',
          image: 'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Rosie Fraser', url: 'https://unsplash.com/photos/mountain-range-under-starry-night-sky-O6VvT8f8kXs' }
        },
        {
          id: 'set_trap', icon: 'fas fa-cog', emote: '🪤',
          title: 'Set a Trap', desc: 'Lay a snare before nightfall comes.',
          image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Sebastian Unrau', url: 'https://unsplash.com/photos/foggy-forest-O6VvT8f8kXs' }
        },
        {
          id: 'fight', icon: 'fas fa-fist-raised', emote: '⚔️',
          title: 'Stand and Fight', desc: 'Draw your blade and face the pack.',
          image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&fit=crop&q=80',
          imageCredit: { artist: 'David Marcu', url: 'https://unsplash.com/photos/silhouette-of-person-standing-on-top-of-mountain-O6VvT8f8kXs' }
        }
      ]
    },

    dragon: {
      id: 'dragon',
      title: 'The Ember Abyss',
      icon: 'fas fa-dragon',
      iconColor: '#d44a0a',
      emote: '🐉',
      image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&fit=crop&q=80',
      imageCredit: { artist: 'NASA', url: 'https://unsplash.com/@nasa' },
      desc: 'The great dragon Vaelthorax rests atop centuries of plunder. Every heartbeat shakes the stone.',
      neighbors: ['mountains'],
      actions: [
        {
          id: 'speak', icon: 'fas fa-comments', emote: '🗣️',
          title: 'Speak to the Dragon', desc: 'Seek wisdom in the ancient flame.',
          image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=300&fit=crop&q=80',
          imageCredit: { artist: 'NASA', url: 'https://unsplash.com/@nasa' }
        },
        {
          id: 'attack', icon: 'fas fa-fist-raised', emote: '⚔️',
          title: 'Attack the Dragon', desc: 'Steel against scales — a fool\'s gambit.',
          image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&fit=crop&q=80',
          imageCredit: { artist: 'Benjamin Voros', url: 'https://unsplash.com/@vorosbenisop' }
        },
        {
          id: 'flee', icon: 'fas fa-running', emote: '🏃',
          title: 'Flee Back', desc: 'Better to run than burn.',
          image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&fit=crop&q=80',
          imageCredit: { artist: 'David Marcu', url: 'https://unsplash.com/@davidmarcu' }
        }
      ]
    }

  }
};

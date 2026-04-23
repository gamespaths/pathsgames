/* =============================================
   PATHS GAME — mock-data.js  (v0.16.3-prototype-api)
   Fixed mock JSON data used when the API server
   is unreachable. Mirrors the real API structure.
   Includes StorySummary.card (CardInfo).
   ============================================= */

var MOCK_STORIES = [
  {
    uuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    title: 'TUTORIAL',
    description: 'A short training adventure in the Academy of Paths.',
    author: 'PathsMaster',
    category: 'tutorial',
    group: 'tutorial',
    visibility: 'PUBLIC',
    priority: 100,
    peghi: 0,
    difficultyCount: 1,
    card: {
      uuid: 'card-tutorial-001',
      imageUrl: null,
      alternativeImage: null,
      awesomeIcon: 'fas fa-graduation-cap',
      styleMain: 'tutorial',
      styleDetail: null,
      title: 'Welcome Hall',
      description: 'A bright, welcoming hall with banners explaining the basics of Paths Games.'
    }
  },
  {
    uuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    title: 'The Valvassor of the March',
    description: 'An epic journey through the lands of the March, where every choice shapes the fate of a kingdom.',
    author: 'PathsMaster',
    category: 'fantasy',
    group: 'main',
    visibility: 'PUBLIC',
    priority: 10,
    peghi: 5,
    difficultyCount: 0,
    card: {
      uuid: 'card-march-001',
      imageUrl: null,
      alternativeImage: null,
      awesomeIcon: 'fas fa-chess-rook',
      styleMain: 'medieval',
      styleDetail: null,
      title: 'Castle of the March',
      description: 'The ancient fortress overlooks the valley. Banners of the Valvassor flutter in the morning breeze.'
    }
  },
  {
    uuid: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    title: 'The Silver Coast',
    description: 'Pirate lords fight for control of the trade routes. Navigate alliances and betrayals.',
    author: 'PathsMaster',
    category: 'adventure',
    group: 'main',
    visibility: 'PUBLIC',
    priority: 20,
    peghi: 3,
    difficultyCount: 2,
    card: {
      uuid: 'card-coast-001',
      imageUrl: null,
      alternativeImage: null,
      awesomeIcon: 'fas fa-anchor',
      styleMain: 'pirate',
      styleDetail: null,
      title: 'Port of Silver',
      description: 'A bustling harbor where merchants and pirates cross paths under the watchful eye of the Harbourmaster.'
    }
  },
  {
    uuid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80',
    title: 'Frost Peaks',
    description: 'Treacherous mountain passes shrouded in eternal snow. Ancient dangers slumber beneath the ice.',
    author: 'PathsMaster',
    category: 'fantasy',
    group: 'main',
    visibility: 'PUBLIC',
    priority: 15,
    peghi: 8,
    difficultyCount: 3,
    card: {
      uuid: 'card-frost-001',
      imageUrl: null,
      alternativeImage: null,
      awesomeIcon: 'fas fa-mountain',
      styleMain: 'frost',
      styleDetail: null,
      title: 'The Summit Pass',
      description: 'Wind howls through narrow passes etched with ancient runes. One wrong step means a fall into darkness.'
    }
  },
  {
    uuid: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8091',
    title: 'The Shadow Plague',
    description: 'A mysterious illness turns villagers into hollow husks. Uncover the source before nightfall.',
    author: 'PathsMaster',
    category: 'adventure',
    group: 'main',
    visibility: 'PUBLIC',
    priority: 25,
    peghi: 4,
    difficultyCount: 1,
    card: {
      uuid: 'card-shadow-001',
      imageUrl: null,
      alternativeImage: null,
      awesomeIcon: 'fas fa-skull-crossbones',
      styleMain: 'dark',
      styleDetail: null,
      title: 'The Hollow Village',
      description: 'Empty eyes stare from darkened doorways. The silence here is deafening, broken only by the creak of rotting timber.'
    }
  }
];

/* ── Story detail (full) — returned by GET /api/stories/{uuid}?lang=en ── */
var MOCK_STORY_DETAILS = {
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d': {
    uuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    title: 'TUTORIAL',
    description: 'A short training adventure in the Academy of Paths.',
    author: 'PathsMaster',
    category: 'tutorial',
    group: 'tutorial',
    visibility: 'PUBLIC',
    priority: 100,
    peghi: 0,
    versionMin: '0.1.0',
    versionMax: null,
    clockSingularDescription: 'hour',
    clockPluralDescription: 'hours',
    copyrightText: '© 2025 Paths Games',
    linkCopyright: 'https://paths.games',
    locationCount: 3,
    eventCount: 5,
    itemCount: 2,
    classCount: 0,
    characterTemplateCount: 1,
    traitCount: 0,
    difficulties: [
      { uuid: 'diff-easy-001', name: 'Easy', description: 'For new adventurers', priority: 1 }
    ],
    characterTemplates: [],
    classes: [
      { uuid: 'class-warrior-001', name: 'Warrior', description: 'Master of melee combat', priority: 1 },
      { uuid: 'class-mage-001', name: 'Mage', description: 'Wielder of arcane magic', priority: 2 },
      { uuid: 'class-rogue-001', name: 'Rogue', description: 'Swift and cunning', priority: 3 }
    ],
    traits: [
      { uuid: 'trait-brave-001', name: 'Brave', description: 'Face dangers without fear', priority: 1 },
      { uuid: 'trait-clever-001', name: 'Clever', description: 'Solve problems with wit', priority: 1 }
    ],
    card: {
      uuid: 'card-tutorial-001',
      imageUrl: null,
      alternativeImage: null,
      awesomeIcon: 'fas fa-graduation-cap',
      styleMain: 'tutorial',
      styleDetail: null,
      title: 'Welcome Hall',
      description: 'A bright, welcoming hall with banners explaining the basics of Paths Games.',
      copyrightText: null,
      linkCopyright: null,
      creator: {
        uuid: 'creator-pm-001',
        name: 'PathsMaster',
        link: 'https://paths.games',
        url: null,
        urlImage: null,
        urlEmote: null,
        urlInstagram: null
      }
    }
  },
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e': {
    uuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    title: 'The Valvassor of the March',
    description: 'An epic journey through the lands of the March, where every choice shapes the fate of a kingdom.',
    author: 'PathsMaster',
    category: 'fantasy',
    group: 'main',
    visibility: 'PUBLIC',
    priority: 10,
    peghi: 5,
    versionMin: '0.1.0',
    versionMax: null,
    clockSingularDescription: 'day',
    clockPluralDescription: 'days',
    copyrightText: '© 2025 Paths Games',
    linkCopyright: 'https://paths.games',
    locationCount: 12,
    eventCount: 25,
    itemCount: 8,
    classCount: 3,
    characterTemplateCount: 2,
    traitCount: 4,
    difficulties: [
      { uuid: 'diff-norm-001', name: 'Normal', description: 'Standard difficulty', priority: 1 },
      { uuid: 'diff-hard-march', name: 'Hard', description: 'For seasoned adventurers', priority: 2 },
      { uuid: 'diff-legend-march', name: 'Legend', description: 'Only for the bravest', priority: 3 }
    ],
    characterTemplates: [],
    classes: [
      { uuid: 'class-knight-001', name: 'Knight', description: 'Noble warrior of the realm', priority: 1 },
      { uuid: 'class-scholar-001', name: 'Scholar', description: 'Keeper of forbidden knowledge', priority: 2 },
      { uuid: 'class-courtier-001', name: 'Courtier', description: 'Master of politics and intrigue', priority: 3 }
    ],
    traits: [
      { uuid: 'trait-honor-001', name: 'Honorable', description: 'Keep your word at all costs', priority: 1 },
      { uuid: 'trait-cunning-001', name: 'Cunning', description: 'Outsmart your enemies', priority: 1 },
      { uuid: 'trait-loyal-001', name: 'Loyal', description: 'Stand by your companions', priority: 2 },
      { uuid: 'trait-ambitious-001', name: 'Ambitious', description: 'Seek power and glory', priority: 2 }
    ],
    card: {
      uuid: 'card-march-001',
      imageUrl: null,
      alternativeImage: null,
      awesomeIcon: 'fas fa-chess-rook',
      styleMain: 'medieval',
      styleDetail: null,
      title: 'Castle of the March',
      description: 'The ancient fortress overlooks the valley. Banners of the Valvassor flutter in the morning breeze.',
      copyrightText: null,
      linkCopyright: null,
      creator: {
        uuid: 'creator-pm-001',
        name: 'PathsMaster',
        link: 'https://paths.games',
        url: null,
        urlImage: null,
        urlEmote: null,
        urlInstagram: null
      }
    }
  },
  'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f': {
    uuid: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    title: 'The Silver Coast',
    description: 'Pirate lords fight for control of the trade routes. Navigate alliances and betrayals.',
    author: 'PathsMaster',
    category: 'adventure',
    group: 'main',
    visibility: 'PUBLIC',
    priority: 20,
    peghi: 3,
    versionMin: '0.2.0',
    versionMax: null,
    clockSingularDescription: 'watch',
    clockPluralDescription: 'watches',
    copyrightText: null,
    linkCopyright: null,
    locationCount: 8,
    eventCount: 15,
    itemCount: 6,
    classCount: 2,
    characterTemplateCount: 3,
    traitCount: 2,
    difficulties: [
      { uuid: 'diff-norm-coast', name: 'Merchant', description: 'Navigate the trade routes safely', priority: 1 },
      { uuid: 'diff-hard-coast', name: 'Pirate', description: 'Seize what you want', priority: 2 }
    ],
    characterTemplates: [],
    classes: [
      { uuid: 'class-captain-001', name: 'Captain', description: 'Lead your crew to fortune', priority: 1 },
      { uuid: 'class-smuggler-001', name: 'Smuggler', description: 'Move through the shadows', priority: 2 }
    ],
    traits: [
      { uuid: 'trait-daring-001', name: 'Daring', description: 'Take bold risks for big rewards', priority: 1 },
      { uuid: 'trait-shrewd-001', name: 'Shrewd', description: 'Every trade is an opportunity', priority: 2 }
    ],
    card: {
      uuid: 'card-coast-001',
      imageUrl: null,
      alternativeImage: null,
      awesomeIcon: 'fas fa-anchor',
      styleMain: 'pirate',
      styleDetail: null,
      title: 'Port of Silver',
      description: 'A bustling harbor where merchants and pirates cross paths under the watchful eye of the Harbourmaster.',
      copyrightText: '© 2025 Paths Games',
      linkCopyright: 'https://paths.games',
      creator: null
    }
  },
  'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80': {
    uuid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80',
    title: 'Frost Peaks',
    description: 'Treacherous mountain passes shrouded in eternal snow. Ancient dangers slumber beneath the ice.',
    author: 'PathsMaster',
    category: 'fantasy',
    group: 'main',
    visibility: 'PUBLIC',
    priority: 15,
    peghi: 8,
    versionMin: '0.1.0',
    versionMax: null,
    clockSingularDescription: 'hour',
    clockPluralDescription: 'hours',
    copyrightText: null,
    linkCopyright: null,
    locationCount: 10,
    eventCount: 18,
    itemCount: 4,
    classCount: 2,
    characterTemplateCount: 2,
    traitCount: 3,
    difficulties: [
      { uuid: 'diff-easy-frost', name: 'Wanderer', description: 'Find safe paths through the peaks', priority: 1 },
      { uuid: 'diff-norm-frost', name: 'Ranger', description: 'Battle the wilderness itself', priority: 2 },
      { uuid: 'diff-hard-frost', name: 'Mountaineer', description: 'Conquer the elements', priority: 3 }
    ],
    characterTemplates: [],
    classes: [
      { uuid: 'class-ranger-001', name: 'Ranger', description: 'Master of survival and tracking', priority: 1 },
      { uuid: 'class-shaman-001', name: 'Shaman', description: 'Commune with the spirits', priority: 2 }
    ],
    traits: [
      { uuid: 'trait-hardy-001', name: 'Hardy', description: 'Endure extreme hardship', priority: 1 },
      { uuid: 'trait-wise-001', name: 'Wise', description: 'Read the land and weather', priority: 2 },
      { uuid: 'trait-spirit-001', name: 'Spiritual', description: 'Trust your inner voice', priority: 3 }
    ],
    card: {
      uuid: 'card-frost-001',
      imageUrl: null,
      alternativeImage: null,
      awesomeIcon: 'fas fa-mountain',
      styleMain: 'frost',
      styleDetail: null,
      title: 'The Summit Pass',
      description: 'Wind howls through narrow passes etched with ancient runes. One wrong step means a fall into darkness.',
      copyrightText: null,
      linkCopyright: null,
      creator: {
        uuid: 'creator-pm-001',
        name: 'PathsMaster',
        link: 'https://paths.games',
        url: null,
        urlImage: null,
        urlEmote: null,
        urlInstagram: null
      }
    }
  },
  'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8091': {
    uuid: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8091',
    title: 'The Shadow Plague',
    description: 'A mysterious illness turns villagers into hollow husks. Uncover the source before nightfall.',
    author: 'PathsMaster',
    category: 'adventure',
    group: 'main',
    visibility: 'PUBLIC',
    priority: 25,
    peghi: 4,
    versionMin: '0.2.0',
    versionMax: null,
    clockSingularDescription: 'hour',
    clockPluralDescription: 'hours',
    copyrightText: null,
    linkCopyright: null,
    locationCount: 6,
    eventCount: 12,
    itemCount: 3,
    classCount: 1,
    characterTemplateCount: 1,
    traitCount: 2,
    difficulties: [
      { uuid: 'diff-norm-shadow', name: 'Investigator', description: 'Uncover the truth before dusk', priority: 1 }
    ],
    characterTemplates: [],
    classes: [
      { uuid: 'class-healer-001', name: 'Healer', description: 'Cure the curse at its source', priority: 1 }
    ],
    traits: [
      { uuid: 'trait-keen-001', name: 'Keen-Eyed', description: 'Notice details others miss', priority: 1 },
      { uuid: 'trait-compassion-001', name: 'Compassionate', description: 'Your empathy reveals secrets', priority: 2 }
    ],
    card: {
      uuid: 'card-shadow-001',
      imageUrl: null,
      alternativeImage: null,
      awesomeIcon: 'fas fa-skull-crossbones',
      styleMain: 'dark',
      styleDetail: null,
      title: 'The Hollow Village',
      description: 'Empty eyes stare from darkened doorways. The silence here is deafening, broken only by the creak of rotting timber.',
      copyrightText: null,
      linkCopyright: null,
      creator: null
    }
  }
};

/* ── Card detail — returned by GET /api/content/{storyUuid}/cards/{cardUuid}?lang=en ── */
var MOCK_CARD_DETAILS = {
  'card-tutorial-001': {
    uuid: 'card-tutorial-001',
    imageUrl: null,
    alternativeImage: null,
    awesomeIcon: 'fas fa-graduation-cap',
    styleMain: 'tutorial',
    styleDetail: null,
    title: 'Welcome Hall',
    description: 'A bright, welcoming hall with banners explaining the basics of Paths Games.',
    copyrightText: null,
    linkCopyright: null,
    creator: {
      uuid: 'creator-pm-001',
      name: 'PathsMaster',
      link: 'https://paths.games',
      url: null,
      urlImage: null,
      urlEmote: null,
      urlInstagram: null
    }
  },
  'card-march-001': {
    uuid: 'card-march-001',
    imageUrl: null,
    alternativeImage: null,
    awesomeIcon: 'fas fa-chess-rook',
    styleMain: 'medieval',
    styleDetail: null,
    title: 'Castle of the March',
    description: 'The ancient fortress overlooks the valley. Banners of the Valvassor flutter in the morning breeze.',
    copyrightText: null,
    linkCopyright: null,
    creator: {
      uuid: 'creator-pm-001',
      name: 'PathsMaster',
      link: 'https://paths.games',
      url: null,
      urlImage: null,
      urlEmote: null,
      urlInstagram: null
    }
  },
  'card-coast-001': {
    uuid: 'card-coast-001',
    imageUrl: null,
    alternativeImage: null,
    awesomeIcon: 'fas fa-anchor',
    styleMain: 'pirate',
    styleDetail: null,
    title: 'Port of Silver',
    description: 'A bustling harbor where merchants and pirates cross paths under the watchful eye of the Harbourmaster.',
    copyrightText: '© 2025 Paths Games',
    linkCopyright: 'https://paths.games',
    creator: null
  },
  'card-frost-001': {
    uuid: 'card-frost-001',
    imageUrl: null,
    alternativeImage: null,
    awesomeIcon: 'fas fa-mountain',
    styleMain: 'frost',
    styleDetail: null,
    title: 'The Summit Pass',
    description: 'Wind howls through narrow passes etched with ancient runes. One wrong step means a fall into darkness.',
    copyrightText: null,
    linkCopyright: null,
    creator: {
      uuid: 'creator-pm-001',
      name: 'PathsMaster',
      link: 'https://paths.games',
      url: null,
      urlImage: null,
      urlEmote: null,
      urlInstagram: null
    }
  },
  'card-shadow-001': {
    uuid: 'card-shadow-001',
    imageUrl: null,
    alternativeImage: null,
    awesomeIcon: 'fas fa-skull-crossbones',
    styleMain: 'dark',
    styleDetail: null,
    title: 'The Hollow Village',
    description: 'Empty eyes stare from darkened doorways. The silence here is deafening, broken only by the creak of rotting timber.',
    copyrightText: null,
    linkCopyright: null,
    creator: null
  }
};

/* ── Hero image (same Unsplash credit as v0.15.4) ── */
var HERO_IMAGE = {
  url: 'https://images.unsplash.com/photo-1546587348-d12660c30c50?w=1920&fit=crop&q=80',
  artist: 'Jaanus Jagomägi',
  profileUrl: 'https://unsplash.com/@jaanus'
};

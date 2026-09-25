/* ═══════════════════════════════════════════
   PATHS GAMES v0.17.5 — Main JavaScript
   ═══════════════════════════════════════════ */

// ── MOCK DATA ─────────────────────────────
const STORIES = [
  {
    id: 1,
    title: 'The Shadow Keep',
    desc: 'A cursed fortress rises from the mist. Brave souls are needed to uncover its dark secrets before the ancient evil consumes the realm.',
    img: 'https://images.unsplash.com/photo-1505816014357-96b5ff457e9a?auto=format&fit=crop&w=600&q=70',
    genre: 'Adventure',
  },
  {
    id: 2,
    title: 'Forest of Whispers',
    desc: 'The ancient wood holds secrets that even the gods have forgotten. Your journey through its twisted paths will test every virtue.',
    img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=70',
    genre: 'Mystery',
  },
  {
    id: 3,
    title: 'Desert of Lost Kings',
    desc: 'Beneath the endless sands lie buried kingdoms and forgotten treasures. The scorching sun hides what the wind can never reveal.',
    img: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=600&q=70',
    genre: 'Exploration',
  },
  {
    id: 4,
    title: 'The Iron Throne of North',
    desc: 'A kingdom torn by civil war needs a champion. Will you forge alliances and restore peace, or seize power for yourself?',
    img: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=600&q=70',
    genre: 'Political',
  },
  {
    id: 5,
    title: 'Seas of Fire',
    desc: 'Sail across cursed waters where sea monsters reign and pirate lords battle for supremacy. Only the bravest dare to chart these waters.',
    img: 'https://images.unsplash.com/photo-1505672678657-cc7037095e60?auto=format&fit=crop&w=600&q=70',
    genre: 'Naval',
  },
];

const CONFIG_OPTIONS = {
  character: [
    { name: 'Fighter',    icon: 'fas fa-sword',      sub: 'Strength is my shield' },
    { name: 'Mage',       icon: 'fas fa-hat-wizard',  sub: 'Power flows through me' },
    { name: 'Rogue',      icon: 'fas fa-user-secret', sub: 'Shadows are my ally' },
    { name: 'Paladin',    icon: 'fas fa-shield-alt',  sub: 'Righteous and true' },
  ],
  class: [
    { name: 'Warrior',    icon: 'fas fa-fist-raised',  sub: 'Master of combat' },
    { name: 'Wizard',     icon: 'fas fa-magic',         sub: 'Keeper of arcane arts' },
    { name: 'Assassin',   icon: 'fas fa-crosshairs',   sub: 'One strike, one kill' },
    { name: 'Cleric',     icon: 'fas fa-pray',          sub: 'Faith is my weapon' },
  ],
  trait: [
    { name: 'Brave',      icon: 'fas fa-fire',          sub: 'Fear nothing' },
    { name: 'Cunning',    icon: 'fas fa-brain',         sub: 'Outsmart all foes' },
    { name: 'Wise',       icon: 'fas fa-eye',           sub: 'Observe and prevail' },
    { name: 'Ruthless',   icon: 'fas fa-skull',         sub: 'Victory at any cost' },
  ],
  difficulty: [
    { name: 'Easy',       icon: 'fas fa-seedling',      sub: 'A peaceful journey' },
    { name: 'Normal',     icon: 'fas fa-balance-scale', sub: 'A balanced challenge' },
    { name: 'Hard',       icon: 'fas fa-fire-alt',      sub: 'Pain forges legends' },
    { name: 'Legendary',  icon: 'fas fa-skull-crossbones', sub: 'Suffer and conquer' },
  ],
};

const GAME_DATA = {
  locations: [
    { name: 'Dark Cave',   icon: 'fas fa-mountain',       img: 'https://images.unsplash.com/photo-1429704658776-3d38d9e931fa?auto=format&fit=crop&w=300&q=60' },
    { name: 'Forest',      icon: 'fas fa-tree',           img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=300&q=60' },
    { name: 'Castle Gate', icon: 'fas fa-chess-rook',     img: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=300&q=60' },
    { name: 'Market',      icon: 'fas fa-store',          img: '' },
    { name: 'Shrine',      icon: 'fas fa-place-of-worship', img: '' },
  ],
  actions: [
    { name: 'Talk to Barkeep', icon: 'fas fa-comments' },
    { name: 'Search Area',     icon: 'fas fa-search' },
    { name: 'Rest',            icon: 'fas fa-bed' },
    { name: 'Craft',           icon: 'fas fa-hammer' },
    { name: 'Pray',            icon: 'fas fa-pray' },
  ],
};

// ── STATE ──────────────────────────────────
let currentStory = null;
let currentConfig = {
  character: CONFIG_OPTIONS.character[0].name,
  class:     CONFIG_OPTIONS.class[0].name,
  trait:     CONFIG_OPTIONS.trait[0].name,
  difficulty:CONFIG_OPTIONS.difficulty[1].name,
};
let selectionType = null;

// ── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderStories();
  bindEvents();
  renderGameView();
});

// ── RENDER STORIES ─────────────────────────
function renderStories() {
  const row = document.getElementById('stories-row');
  row.innerHTML = '';
  STORIES.forEach(story => {
    const card = document.createElement('div');
    card.className = 'story-netflix-card';
    card.innerHTML = `
      <div class="story-netflix-card-play"><i class="fas fa-play"></i></div>
      <span class="story-netflix-card-badge">${story.genre}</span>
      <img src="${story.img}" alt="${story.title}" loading="lazy">
      <div class="story-netflix-card-body">
        <h4>${story.title}</h4>
        <p>${story.desc}</p>
      </div>
    `;
    card.addEventListener('click', () => openBook(story));
    row.appendChild(card);
  });
}

// ── BOOK OPEN/CLOSE ────────────────────────
function openBook(story) {
  currentStory = story;

  // Fill left page
  document.getElementById('modal-story-title').textContent = story.title;
  document.getElementById('modal-story-desc').textContent = story.desc;
  document.getElementById('modal-story-img').src = story.img;
  document.getElementById('terms-chk').checked = false;

  // Reset to config view
  showConfigView();

  // Show modal
  const overlay = document.getElementById('book-modal');
  overlay.classList.remove('hidden');
  overlay.style.animation = 'none';
  requestAnimationFrame(() => {
    overlay.style.animation = 'fadeIn 0.4s ease';
  });
}

function closeBook() {
  document.getElementById('book-modal').classList.add('hidden');
}

// ── BIND EVENTS ────────────────────────────
function bindEvents() {
  // Close book
  document.getElementById('btn-close-book').addEventListener('click', closeBook);

  // Close on backdrop click
  document.getElementById('book-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('book-modal')) closeBook();
  });

  // Change buttons (delegated)
  document.getElementById('config-view').addEventListener('click', (e) => {
    const btn = e.target.closest('.change-btn');
    if (btn) openSelectionView(btn.dataset.type);
  });

  // Back button
  document.getElementById('btn-back').addEventListener('click', showConfigView);

  // Start Game
  document.getElementById('btn-start-game').addEventListener('click', () => {
    closeBook();
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('game-view').classList.remove('hidden');
  });
}

// ── CONFIG VIEW ────────────────────────────
function showConfigView() {
  // Update displayed values
  document.getElementById('sel-character').textContent = currentConfig.character;
  document.getElementById('sel-class').textContent     = currentConfig.class;
  document.getElementById('sel-trait').textContent     = currentConfig.trait;
  document.getElementById('sel-difficulty').textContent= currentConfig.difficulty;

  document.getElementById('config-view').classList.remove('hidden');
  document.getElementById('selection-view').classList.add('hidden');
}

// ── SELECTION VIEW ─────────────────────────
function openSelectionView(type) {
  selectionType = type;
  const labels = {
    character: 'Choose your Character',
    class:     'Choose your Class',
    trait:     'Choose a Trait',
    difficulty:'Choose Difficulty',
  };
  document.getElementById('selection-title').textContent = labels[type] || `Select ${type}`;

  // Build choice cards
  const list = document.getElementById('selection-list');
  list.innerHTML = '';
  const options = CONFIG_OPTIONS[type] || [];
  options.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'choice-card' + (opt.name === currentConfig[type] ? ' selected-card' : '');
    card.innerHTML = `
      <i class="${opt.icon} choice-card-icon"></i>
      <div class="choice-card-name">${opt.name}</div>
      <div class="choice-card-sub">${opt.sub}</div>
      <button class="choice-select-btn">${opt.name === currentConfig[type] ? '✓ Selected' : 'Select'}</button>
    `;
    card.addEventListener('click', () => selectOption(type, opt.name));
    list.appendChild(card);
  });

  document.getElementById('config-view').classList.add('hidden');
  document.getElementById('selection-view').classList.remove('hidden');
}

function selectOption(type, value) {
  currentConfig[type] = value;
  showConfigView();
}

// ── GAME VIEW ──────────────────────────────
function renderGameView() {
  // Locations row
  const locRow = document.getElementById('game-locations-row');
  locRow.innerHTML = '';
  GAME_DATA.locations.forEach(loc => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `<i class="${loc.icon}"></i><div class="game-card-name">${loc.name}</div>`;
    card.title = `Move to: ${loc.name}`;
    locRow.appendChild(card);
  });

  // Actions row
  const actRow = document.getElementById('game-actions-row');
  actRow.innerHTML = '';
  GAME_DATA.actions.forEach(act => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `<i class="${act.icon}"></i><div class="game-card-name">${act.name}</div>`;
    actRow.appendChild(card);
  });
}

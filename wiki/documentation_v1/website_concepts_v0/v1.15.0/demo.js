/* Paths Games — v1.15.0 concept: the 1.13.0 concept aligned to react-game 1.14.0; bookmarks on the book's right side on
   desktop, on top on tablets, on the book's edges on phones. Plain browser JS, no build. */
(function () {
  'use strict';

  /* Base timings in ms at speed 1; the speed control divides them (default ¼ = 4× longer, as 1.14.0). */
  const BASE = {
    open: 650, close: 260, deal: 620, dealStep: 110, lift: 240, fly: 560,
    discard: 320, discardStep: 50, flip: 900, simple: 520, sheet: 620, fade: 220, slide: 600,
  };
  const MAX_STAGGER = 8; // later cards land with the eighth: a long list never makes the player wait
  // Same query as react-game src/features/gameplay/js/mobileView.js (MOBILE_MQ).
  const MOBILE_MQ = '(max-width: 767px), (max-width: 991px) and (orientation: landscape) and (max-height: 500px)';
  const HOME_IMG = 'https://images.unsplash.com/photo-1439396874305-9a6ba25de6c6?q=80&w=1333&auto=format&fit=crop';
  const D20 = '<i class="fas fa-dice-d20 d20"></i>';
  const DECK = `<div class="deck" aria-hidden="true"><span></span><span></span><span>${D20}</span></div>`;
  const SPINNER = '<i class="fas fa-spinner fa-spin"></i><span class="gc-footer__btn-label">Resolving…</span>';
  const GAME_TABS = ['board', 'info', 'backpack', 'map', 'missions'];

  /* ═══════════════ data ═══════════════ */
  const STORIES = [
    { id: 'tutorial', title: 'The First Steps', category: 'Tutorial', icon: 'fa-graduation-cap', c1: '#7a6a3a', c2: '#1a140a',
      desc: 'A short walk through the valley that teaches how the book works: cards, pages, energy and missions.' },
    { id: 'valley', title: 'The Valley of Paths', category: 'Fantasy', icon: 'fa-map-signs', c1: '#8a5a2b', c2: '#1a0a02', match: 'active',
      desc: 'Four roads meet under a leaning signpost. A mill, a dark forest and a tower that nobody has opened in years.' },
    { id: 'kaldor', title: 'Shadows over Kaldor', category: 'Fantasy', icon: 'fa-dragon', c1: '#5a2a6b', c2: '#14061a',
      desc: 'The old dragon of Kaldor has been seen again over the northern hills, and the city gates are closing early.' },
    { id: 'harbour', title: 'The Iron Harbour', category: 'Adventure', icon: 'fa-anchor', c1: '#3a5a78', c2: '#0b1622', match: 'completed',
      desc: 'Smugglers, rusty chains and a ship that sails only on moonless nights.' },
    { id: 'deep', title: 'Echoes of the Deep', category: 'Horror', icon: 'fa-ghost', c1: '#2a3a3a', c2: '#060c0c', soon: true,
      desc: 'Something answers when you call into the old mine.' },
    { id: 'caravan', title: 'The Last Caravan', category: 'Adventure', icon: 'fa-horse', c1: '#a0622e', c2: '#2e1508', soon: true,
      desc: 'Seven wagons, one map and a desert that moves at night.' },
  ];
  const storyById = id => STORIES.find(s => s.id === id && !s.soon) || null;

  const OPTIONS = {
    class: { label: 'Class', icon: 'fa-shield-alt', list: [
      { id: 'warrior', title: 'Warrior', icon: 'fa-shield-alt', c1: '#8a3a1a', c2: '#2a0a02', stats: { dex: 1, int: 0, con: 3 },
        desc: 'Heavy armour and a heavier sword: slow to start, hard to stop.' },
      { id: 'mage', title: 'Mage', icon: 'fa-hat-wizard', c1: '#4b3a8a', c2: '#0e0a24', stats: { dex: 0, int: 3, con: 1 },
        desc: 'Reads the old signs on the stones and makes the lights obey.' },
      { id: 'rogue', title: 'Rogue', icon: 'fa-user-ninja', c1: '#2f3a2a', c2: '#0a0c08', stats: { dex: 3, int: 1, con: 0 },
        desc: 'Quick hands, quiet feet and a pocket for everything.' },
      { id: 'cleric', title: 'Cleric', icon: 'fa-ankh', c1: '#8a7a3a', c2: '#1a160a', stats: { dex: 0, int: 2, con: 2 },
        desc: 'Heals the party and talks to the dead.', lock: 'Not allowed by current selection' },
    ] },
    character: { label: 'Character', icon: 'fa-user', list: [
      { id: 'bran', title: 'Bran', icon: 'fa-user', c1: '#7a4520', c2: '#1a0a02', stats: { dex: 1, int: 1, con: 1 },
        desc: 'A wanderer with good boots, a short temper and a long memory.' },
      { id: 'elsa', title: 'Elsa', icon: 'fa-female', c1: '#9a6f08', c2: '#2e1508', stats: { dex: 1, int: 2, con: 0 },
        desc: 'The miller\'s daughter, who knows every path of the valley.' },
      { id: 'tom', title: 'Tom', icon: 'fa-child', c1: '#4f6b2a', c2: '#101a06', stats: { dex: 2, int: 0, con: 1 },
        desc: 'Young, curious and always one step ahead of the others.' },
    ] },
    trait: { label: 'Trait', icon: 'fa-star', list: [
      { id: 'brave', title: 'Brave', icon: 'fa-fist-raised', c1: '#9b2c2c', c2: '#2a0808', stats: { dex: 0, int: 0, con: 1 },
        desc: 'Never steps back from a fight, even when it should.' },
      { id: 'curious', title: 'Curious', icon: 'fa-search', c1: '#3a5a78', c2: '#0b1622', stats: { dex: 0, int: 1, con: 0 },
        desc: 'Opens every door and reads every note.' },
      { id: 'lucky', title: 'Lucky', icon: 'fa-dice', c1: '#6b4fa0', c2: '#160d2a', stats: { dex: 1, int: 0, con: 0 },
        desc: 'The dice like you. Most of the time.' },
      { id: 'strong', title: 'Strong', icon: 'fa-dumbbell', c1: '#6b5c4a', c2: '#1a140e', stats: { dex: 0, int: 0, con: 2 },
        desc: 'Carries twice the weight of anyone else.', lock: 'Trait cost budget exceeded' },
    ] },
    difficulty: { label: 'Difficulty', icon: 'fa-balance-scale', list: [
      { id: 'easy', title: 'Easy', icon: 'fa-feather', c1: '#4f6b2a', c2: '#101a06', life: 12, desc: 'More life, gentler events.' },
      { id: 'normal', title: 'Normal', icon: 'fa-balance-scale', c1: '#7a4520', c2: '#1a0a02', life: 10, desc: 'The valley as it was written.' },
      { id: 'hard', title: 'Hard', icon: 'fa-skull', c1: '#4a1a1a', c2: '#120404', life: 8, desc: 'Less life, darker nights.' },
    ] },
  };
  const DEFAULT_CONFIG = { class: 'warrior', character: 'bran', trait: 'brave', difficulty: 'normal' };
  const optionOf = (type, id) => OPTIONS[type].list.find(o => o.id === id);

  /* The game: a tiny valley. Movement cards borrow icon and colours from the page they lead to. */
  const PLACES = {
    crossroads: {
      place: true, title: 'The Crossroads', icon: 'fa-map-signs', c1: '#8a5a2b', c2: '#1a0a02',
      desc: 'Four roads meet under a leaning signpost. The wind brings the smell of flour from the north and something darker from the east. In the middle of the square an old well waits, its rope still wet.',
      cards: [
        { title: 'Old Mill', type: 'Movement', cost: 2, to: 'mill' },
        { title: 'Dark Forest', type: 'Movement', cost: 3, to: 'forest' },
        { title: 'Search the well', type: 'Action', cost: 1, to: 'well', icon: 'fa-search', c1: '#3a5a78', c2: '#0b1622',
          desc: 'The rope is wet: someone used it today.', effect: g => { g.hasKey = true; } },
        { title: 'Stone Tower', type: 'Movement', cost: 2, to: 'tower', lock: g => (g.hasKey ? null : 'Needs a key') },
      ],
    },
    mill: {
      place: true, title: 'The Old Mill', icon: 'fa-wind', c1: '#b07a3e', c2: '#2e1508',
      desc: 'The great wheel turns slowly in the stream. Flour dust dances in the light that comes through the broken boards, and somewhere inside a man is singing off-key.',
      cards: [
        { title: 'Crossroads', type: 'Movement', cost: 2, to: 'crossroads', back: true },
        { title: 'Talk to the miller', type: 'Choice', to: 'miller', icon: 'fa-comments', desc: 'He looks like a man with a story to tell.' },
        { title: 'Rest by the wheel', type: 'Action', to: 'rest', icon: 'fa-bed', desc: 'Sleep gives back all your energy.',
          effect: g => { g.energy = g.energyMax; } },
      ],
    },
    miller: {
      title: 'The Miller', icon: 'fa-user', c1: '#9a6f08', c2: '#2e1508',
      desc: '“The tower key? It fell into the well when I was a boy,” he laughs, wiping his hands on the apron. “Nobody has had the patience to look for it since.”',
      cards: [{ title: 'Old Mill', type: 'Movement', to: 'mill', back: true }],
    },
    rest: {
      title: 'By the Wheel', icon: 'fa-moon', c1: '#3b3a6b', c2: '#0d0b1e',
      desc: 'You sleep to the sound of water. When you wake, your legs feel light again and the sun is already high above the roof.',
      cards: [{ title: 'Wake up', type: 'Action', to: 'mill', back: true, icon: 'fa-sun', c1: '#c8960a', c2: '#5c3317' }],
    },
    forest: {
      place: true, title: 'The Dark Forest', icon: 'fa-tree', c1: '#2f5a2a', c2: '#0c1a08',
      desc: 'The trees close above you like the roof of a church. Between the trunks, small blue lights blink and move away whenever you look straight at them.',
      cards: [
        { title: 'Crossroads', type: 'Movement', cost: 3, to: 'crossroads', back: true },
        { title: 'Follow the lights', type: 'Choice', to: 'ring' },
        { title: 'Climb the oak', type: 'Action', icon: 'fa-leaf', c1: '#4f6b2a', c2: '#101a06', lock: () => 'Too tired' },
      ],
    },
    ring: {
      place: true, title: 'The Fairy Ring', icon: 'fa-hat-wizard', c1: '#4b3a8a', c2: '#0e0a24',
      desc: 'A circle of white mushrooms glows in a clearing. The lights gather above it and, for a moment, you hear music that no instrument is playing.',
      cards: [{ title: 'Dark Forest', type: 'Movement', to: 'forest', back: true }],
    },
    well: {
      place: true, title: 'The Well', icon: 'fa-water', c1: '#3a5a78', c2: '#0b1622',
      desc: 'You lower the bucket three times. On the third, something rings against the metal: an iron key, cold and covered in moss. The tower can be opened now.',
      cards: [{ title: 'Crossroads', type: 'Movement', to: 'crossroads', back: true }],
    },
    tower: {
      place: true, title: 'The Stone Tower', icon: 'fa-chess-rook', c1: '#6b5c4a', c2: '#1a140e',
      desc: 'The key turns with a groan and the door opens on a spiral staircase. The demo path ends here — in Paths Games, this is where the next page would begin.',
      cards: [{ title: 'Start again', type: 'Action', to: 'crossroads', back: true, icon: 'fa-redo', c1: '#7a4520', c2: '#1a0a02',
        effect: g => { g.hasKey = false; } }],
    },
  };

  const POLICIES = {
    privacy: { title: 'Privacy Policy', icon: 'fa-shield-alt', text: `
      <h4>What we keep</h4><p>A guest plays without an account: we keep an anonymous identifier and the matches it played.</p>
      <h4>In your browser</h4><p>Language, theme, text size, columns and animation preferences stay in this browser only
      (localStorage) and never reach our servers.</p><h4>Your rights</h4><p>You can delete your account and every match from the player page.</p>` },
    terms: { title: 'Terms of Service', icon: 'fa-file-contract', text: `
      <h4>The game</h4><p>Paths Games is a free gamebook in alpha: pages, cards and rules may change between versions.</p>
      <h4>Fair play</h4><p>One match per story at a time; automated play and attacks on the service are not allowed.</p>` },
    cookies: { title: 'Cookies Policy', icon: 'fa-cookie-bite', text: `
      <h4>Strictly necessary</h4><p>Guest session, refresh token, cookie choices and the anti-bot pass. They cannot be switched off.</p>
      <h4>Browser storage</h4><p>pathsgames.lang, pathsgames.highContrast and pathsgames.preferences remember the choices you make.</p>
      <h4>Analytics</h4><p>Only with your consent.</p>` },
    credits: { title: 'Credits', icon: 'fa-users', text: `
      <h4>Pictures</h4><p>Home: Lili Popper on Unsplash. Icons: Font Awesome (CC BY 4.0).</p>
      <h4>Stories</h4><p>Written by the Paths Games team and its authors.</p>` },
    roadmap: { title: 'What is new', icon: 'fa-newspaper', text: `
      <h4>1.15.0 — Bookmarks beside the book</h4><p>On desktop the tabs leave the top edge and hang on the book's right side, home at the bottom; the book grows taller. Tablets keep the tabs on top; on phones they become icon-only tabs of the book, home under its bottom-right corner.</p><h4>1.13.0 — Book UI and card animations</h4><p>Every page is a book under the navbar; cards are dealt from a deck,
      played with a glow, and the pages turn on the spine.</p><h4>Next</h4><p>i18n and accessibility, then audio.</p>` },
  };

  /* ═══════════════ helpers and state ═══════════════ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const val = x => (typeof x === 'function' ? x() : x);
  const isMobile = () => window.matchMedia(MOBILE_MQ).matches;
  const isSideTabs = () => window.matchMedia('(min-width: 1121px)').matches; // v1.15.0: the desktop side tabs (demo.css)
  const px = box => Object.fromEntries(['left', 'top', 'width', 'height'].map(k => [k, box[k] + 'px']));

  const els = {
    navbar: $('#navbar'), stage: $('#stage'), shell: $('#shell'),
    bookmarks: $('#bookmarks'), book: $('#book'), pages: $('#pages'),
    left: $('#page-left'), right: $('#page-right'), toast: $('#toast'),
    fab: $('#demo-fab'), panel: $('#demo-panel'),
  };
  const app = {
    route: { page: 'home' }, busy: false, cards: [], spread: null, preview: null, chapter: null,
    story: null, config: {}, game: null, ps: {}, ignoreHash: false, pendingRoute: false,
    pageCard: {}, pageNote: {},
  };
  const fx = {};
  let T = {};
  let dealObserver = null;

  function readControls() {
    fx.deal = $('#fx-deal').checked;
    fx.faceDown = $('#fx-facedown').checked;
    fx.play = $('#fx-play').checked;
    fx.turn = $('#fx-turn').checked;
    fx.turnMode = $('#fx-turn-mode').value;
    fx.cover = $('#fx-cover').checked; // planned VITE_ANIM_COVER: the book change and the first-load opening
    fx.coverMax = Number($('#fx-cover-max').value) * 1000; // planned VITE_ANIM_COVER_MAX_S (default 10): 0 = no limit
    fx.speed = Number($('#fx-speed').value);
    fx.latency = Number($('#fx-latency').value);
    fx.vibrate = $('#fx-vibrate').checked;
    els.shell.classList.toggle('deck-over', $('#fx-deck').value === 'over');
    fx.reduced = $('#fx-reduced').checked || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    T = {};
    const root = document.documentElement;
    for (const [key, ms] of Object.entries(BASE)) {
      T[key] = Math.round(ms / fx.speed);
      root.style.setProperty('--t-' + key, T[key] + 'ms');
    }
    root.classList.toggle('reduce-motion', fx.reduced);
    $('#fx-latency-out').textContent = fx.latency + ' ms';
    $('#fx-facedown').disabled = !fx.deal;
    $('#fx-turn-mode').disabled = !fx.turn;
    $('#fx-cover-max').disabled = !fx.cover;
  }
  const animated = flag => flag && !fx.reduced;
  const setNavHeight = () => document.documentElement.style.setProperty('--nav-h', els.navbar.offsetHeight + 'px');

  function setBusy(on) {
    app.busy = on;
    els.book.classList.toggle('is-busy', on);
    els.bookmarks.classList.toggle('is-busy', on);
    if (!on && app.pendingRoute) {
      app.pendingRoute = false;
      setTimeout(openRoute, 0);
    }
  }
  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add('is-on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove('is-on'), 2400);
  }
  function vibrate() {
    if (fx.vibrate && navigator.vibrate) navigator.vibrate(15); // Android only; iOS has no API
  }
  function restartAnimation(el, className) {
    el.classList.remove(className);
    void el.offsetWidth; // reflow, so the same class plays again
    el.classList.add(className);
  }
  function shade() {
    const el = document.createElement('div');
    el.className = 'flip-shade';
    return el;
  }

  /* ═══════════════ rendering ═══════════════ */
  function look(card) {
    const target = card.to ? PLACES[card.to] : {};
    return { icon: card.icon || target.icon, c1: card.c1 || target.c1, c2: card.c2 || target.c2 };
  }
  /* BonusBadgeList: one coloured icon per statistic, as STAT_VISUAL in the react-game */
  const ICON_COLORS = {
    'fa-heart': '#e74c3c', 'fa-bolt': '#f39c12', 'fa-sad-tear': '#dee694', 'fa-running': '#3498db', 'fa-brain': '#9b59b6',
    'fa-heartbeat': '#8e44ad', 'fa-weight-hanging': '#95a5a6', 'fa-star': '#9b59b6',
  };
  const badgeHTML = b => `<span class="stat-badge bonus-badge"><i class="fas ${b.icon}" style="color:${ICON_COLORS[b.icon] || 'var(--color-gold-light)'}"></i>${b.text}</span>`;
  const badgeList = (items, cls) => (items && items.length ? `<div class="bonus-badge-list ${cls}">${items.map(badgeHTML).join('')}</div>` : '');

  /* CardButtons: (i) preview, the main action (or its selected state), the secondary actions,
     or the locked label with its lock icon */
  function footerHTML(card, i) {
    const info = card.info === false ? ''
      : `<button type="button" class="gc-footer__btn gc-footer__btn--icon" data-info="${i}" data-tip="Details" aria-label="Details"><i class="fas fa-info"></i></button>`;
    const lock = val(card.lock);
    if (lock) return `${info}<span class="gc-footer__note is-lock"><i class="fas ${card.lockIcon || 'fa-lock'}"></i> ${lock}</span>`;
    const note = val(card.note);
    if (note) return `${info}<span class="gc-footer__note"><i class="fas ${note.icon}"></i> ${note.text}</span>`;
    if (!card.act) return info;
    const selected = val(card.selected);
    const main = `<button type="button" class="gc-footer__btn${selected ? ' gc-footer__btn--selected' : ''}" data-act="${i}"${selected ? ' aria-pressed="true"' : ''}>`
      + `<i class="fas ${selected ? 'fa-check' : (val(card.btnIcon) || 'fa-hand-pointer')}"></i>`
      + `<span class="gc-footer__btn-label">${val(card.label) || 'Play'}</span></button>`;
    const more = (card.actions || []).map((a, j) => `<button type="button" class="gc-footer__btn gc-footer__btn--icon" data-act2="${i}:${j}" `
      + `data-tip="${a.label}" aria-label="${a.label}"><i class="fas ${a.icon}"></i></button>`).join('');
    return `${info}${main}${more}`;
  }

  /* little card: title (name, cost, little statistics, type badge on hover), picture (category,
     status, full statistics), CardButtons footer; the back face is only the d20 pattern */
  function cardHTML(card, i, dealt) {
    const { icon, c1, c2 } = look(card);
    const cost = card.cost ? `<span class="gc-cost"><i class="fas fa-bolt"></i>${card.cost}</span>` : '';
    const classes = ['pg-card', val(card.lock) ? 'is-locked' : '', val(card.selected) ? 'is-selected' : '',
      animated(fx.deal) && !dealt ? 'pre-deal' : ''].filter(Boolean).join(' ');
    return `<div class="${classes}" style="--i:${i}">
      <div class="face front">
        <div class="gc-title"><div class="gc-title__text">${val(card.title)}</div>${cost}
          ${badgeList(val(card.titleBadges), 'gc-title__badges')}<span class="gc-type-badge">${card.type}</span></div>
        <div class="gc-img" style="--c1:${c1};--c2:${c2}"><i class="fas ${icon}"></i>
          ${card.category ? `<span class="gc-cat-badge">${card.category}</span>` : ''}
          ${card.status ? `<span class="gc-status"><i class="fas ${card.status.icon}"></i>${card.status.text}</span>` : ''}
          ${badgeList(val(card.badges), 'gc-badges')}
        </div>
        <div class="gc-footer${card.actions ? ' has-actions' : ''}">${footerHTML(card, i)}</div>
      </div>
      <div class="face back">${D20}</div>
    </div>`;
  }

  /* page card: title with back arrow, picture with the statistics overlay, description with the
     TipNote, extraContent, the page CardButtons bar and the CardCreditsBar */
  const NOTE_ICONS = { tip: 'fa-lightbulb', story: 'fa-feather-alt', image: 'fa-camera' };
  function noteHTML(L, side, kind) {
    if (!kind) return '';
    const c = L.credits || {};
    const text = kind === 'tip' ? L.tip : kind === 'story' ? c.story : c.image;
    if (!text) return '';
    const link = kind === 'image' && c.imageUrl
      ? `<a class="pg-note__link" href="${c.imageUrl}" target="_blank" rel="noopener" aria-label="Open the original"><i class="fas fa-external-link-alt"></i></a>` : '';
    return `<div class="pg-note${kind === 'tip' ? '' : ' pg-note--single'}" role="note"><i class="fas ${NOTE_ICONS[kind]} pg-note__icon"></i>`
      + `<span class="pg-note__text">${text}</span>${link}`
      + `<button type="button" class="pg-note__hide" data-note-hide="${side}" aria-label="Hide"><i class="fas fa-eye-slash"></i></button></div>`;
  }
  function creditsHTML(L, side) {
    const c = L.credits || {};
    if (!L.type && !L.tip && !c.story && !c.image) return '';
    const entry = (kind, label) => `<button type="button" class="gc-credits__tip" data-note="${side}:${kind}"><i class="fas ${NOTE_ICONS[kind]}"></i> ${label}</button>`;
    return `<div class="gc-credits">${L.type ? `<span class="gc-type-badge-credits">${L.type}</span>` : ''}`
      + `${L.tip ? entry('tip', 'Tip') : ''}<span class="gc-credits__text">${c.story ? entry('story', 'Story') : ''}${c.image ? entry('image', 'Picture') : ''}</span></div>`;
  }
  function leftHTML(L, side = 'left', note = null) { // the tip is closed by default
    const back = L.back ? '<button type="button" class="page-nav" data-back="1" data-tip="Back" aria-label="Back"><i class="fas fa-arrow-left"></i></button>' : '';
    const overlay = badgeList(val(L.badges), 'book-page-img-badge-overlay');
    const pic = L.img
      ? `<div class="loc-img has-photo" style="background-image:url('${L.img}')">${overlay}</div>`
      : `<div class="loc-img" style="--c1:${L.c1};--c2:${L.c2}"><i class="fas ${L.icon}"></i>${overlay}</div>`;
    const extra = val(L.extra);
    const buttons = (L.buttons || []).map((b, j) => `<button type="button" class="gc-footer__btn" data-page-act="${side}:${j}">`
      + `<i class="fas ${b.icon || 'fa-hand-pointer'}"></i><span class="gc-footer__btn-label">${b.label}</span></button>`).join('');
    return `<div class="loc-page">
      <h2 class="book-page-title">${back}<span>${L.title}</span></h2>
      ${pic}
      <div class="book-page-desc">${L.desc}${noteHTML(L, side, note)}</div>
      ${extra ? `<div class="book-page-extra">${extra}</div>` : ''}
      ${buttons ? `<div class="book-page-buttons">${buttons}</div>` : ''}
      ${creditsHTML(L, side)}
    </div>`;
  }
  /* the page cards on screen, with the note each one shows (tip, story or picture credit) */
  function showPageCard(side, L, note = null) {
    app.pageCard[side] = L;
    app.pageNote[side] = note;
    innerOf(side === 'left' ? els.left : els.right).innerHTML = leftHTML(L, side, note);
  }
  function toggleNote(side, kind) {
    const L = app.pageCard[side];
    if (!L || app.busy) return;
    showPageCard(side, L, kind && app.pageNote[side] !== kind ? kind : null);
  }

  function rightHTML(S, { withCards = true, dealt = false } = {}) {
    // The heading over the cards is hidden by the CSS: its place is kept for the multiplayer messages.
    const head = `<div class="right-head"><i class="fas ${S.head.icon || 'fa-scroll'}"></i>${S.head.text}</div>`;
    if (S.text) return head + `<div class="policy-text">${S.text}</div>`;
    const cards = S.cards || [];
    const cols = 'cols-' + Math.min(Math.max(cards.length, 1), 3);
    return head + `<div class="selection-list ${cols}">${withCards ? cards.map((c, i) => cardHTML(c, i, dealt)).join('') : ''}</div>`;
  }

  const innerOf = pageEl => $('.page-inner', pageEl);
  const listEl = () => $('.selection-list', els.right);
  const cardEls = () => [...(listEl()?.children || [])];
  const setLeft = S => showPageCard('left', S.left);
  function setRight(S) {
    stopDeal();
    app.spread = S;
    app.cards = S.cards || [];
    const inner = innerOf(els.right);
    inner.innerHTML = rightHTML(S);
    inner.scrollTop = 0;
  }
  const render = S => { setLeft(S); setRight(S); };

  /* footers, locks and selections change in place: no new deal */
  function refreshFooters() {
    const nodes = cardEls();
    app.cards.forEach((card, i) => {
      const el = nodes[i];
      if (!el) return;
      $('.gc-footer', el).innerHTML = footerHTML(card, i);
      el.classList.toggle('is-locked', Boolean(val(card.lock)));
      el.classList.toggle('is-selected', Boolean(val(card.selected)));
    });
    renderBookmarks();
  }
  /* a late answer (anti-bot check) refreshes the page once nothing else is moving */
  function refreshSoon(page) {
    const tick = () => {
      if (app.route.page !== page) return;
      if (app.busy) { setTimeout(tick, 200); return; }
      if (!app.preview && !app.chapter) {
        setLeft(currentSpread());
        refreshFooters();
      }
    };
    tick();
  }

  /* The game's section tabs and the close (home) tab, on every page but the Home. v1.15.0: desktop hangs them all on
     the book's right side (sections at the top, home at the bottom); tablets keep the top row (sections over the left
     page, home over the right one); phones hang the sections on the book's top edge and home under its bottom-right
     corner, icon only (CSS). The label is the drawn tooltip (beside a side tab) and the screen-reader name. */
  const HOME_TAB = { key: 'home', icon: 'fa-home', label: 'Back to the home page' };
  function renderBookmarks() {
    const ctrl = controller();
    const left = !app.chapter && ctrl.bookmarks ? ctrl.bookmarks() : [];
    const right = app.route.page === 'home' ? [] : [HOME_TAB];
    const tab = b => {
      const cls = ['book-bookmark', b.active ? 'is-active' : '', b.danger ? 'is-danger' : '', b.alert ? 'is-alert' : '']
        .filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" data-bm="${b.key}" data-tip="${b.label}" data-tip-side="left" aria-label="${b.label}"`
        + `${b.active ? ' aria-current="page"' : ''}><i class="fas ${b.icon}"></i>${(b.badges || []).map(badgeHTML).join('')}</button>`;
    };
    els.bookmarks.innerHTML = `<div class="bm-group bm-group--tabs">${left.map(tab).join('')}</div>`
      + `<div class="bm-group bm-group--home">${right.map(tab).join('')}</div>`;
    els.bookmarks.classList.toggle('is-empty', left.length + right.length === 0);
  }

  /* ═══════════════ shared card builders ═══════════════ */
  function statBadges(stats) {
    if (!stats) return null;
    return [
      { icon: 'fa-running', text: stats.dex }, { icon: 'fa-brain', text: stats.int }, { icon: 'fa-heartbeat', text: stats.con },
    ];
  }
  function totals(cfg) {
    const sum = { dex: 0, int: 0, con: 0 };
    ['class', 'character', 'trait'].forEach(type => {
      const s = optionOf(type, cfg[type]).stats;
      Object.keys(sum).forEach(k => { sum[k] += s[k]; });
    });
    return sum;
  }
  function attributesCard(cfg) {
    const t = totals(cfg);
    return { title: 'Attributes', type: 'Bonuses', icon: 'fa-chart-bar', c1: '#5c3317', c2: '#1a0a02',
      desc: 'Dexterity, intelligence and constitution from class, character and trait; the weight you can carry.',
      badges: [...statBadges(t), { icon: 'fa-weight-hanging', text: 10 }],
      note: { icon: 'fa-dice-d20', text: 'From your choices' } };
  }
  function heroCard(cfg) {
    const life = optionOf('difficulty', cfg.difficulty).life;
    return { title: 'Your hero', type: 'Bonuses', icon: 'fa-user-shield', c1: '#7a4520', c2: '#1a0a02',
      desc: 'Life, energy and sadness at the first page, and the trait budget.',
      badges: [{ icon: 'fa-heart', text: life }, { icon: 'fa-bolt', text: 10 }, { icon: 'fa-sad-tear', text: 5 },
        { icon: 'fa-star', text: '1/2' }] };
  }
  const storyCredit = s => `“${s.title}” — written by the Paths Games team, CC BY-SA 4.0.`;
  const TIPS = {
    Story: 'Choose class, character, trait and difficulty, then start: every choice changes your hero.',
    Location: 'Movement cards cost the energy shown by the bolt: when you are short of it, rest.',
    Movement: 'Go spends the energy shown on the card and turns the page to the next place.',
    Action: 'An action can change the story: read its card before playing it.',
    Choice: 'A choice may close other paths: the (i) tells what you know of it.',
    Item: 'Use it here, or drop it to free some weight in the backpack.',
    Stat: 'Statistics change with the cards you play and the nights you sleep.',
  };
  function storyLeft(s, extra) {
    return { title: s.title, icon: s.icon, c1: s.c1, c2: s.c2, desc: `<p>${s.desc}</p>`, type: 'Story',
      tip: TIPS.Story, credits: { story: storyCredit(s) }, ...extra };
  }
  const antibotHTML = ok => (ok
    ? '<span class="antibot is-ok"><i class="fas fa-check-circle"></i> Success! You are human.</span>'
    : '<span class="antibot"><i class="fas fa-spinner fa-spin"></i> Verifying you are human…</span>');

  /* ═══════════════ pages ═══════════════ */
  const HOME = {
    enter() {
      app.ps.home = app.ps.home || { verified: false };
      // 1.14.0: the success line follows a check passed on this visit and leaves after 4 s.
      if (!app.ps.home.verified) setTimeout(() => {
        app.ps.home.verified = true;
        app.ps.home.successUntil = Date.now() + 4000;
        refreshSoon('home');
        setTimeout(() => refreshSoon('home'), 4050);
      }, 1300);
    },
    spread() {
      const h = app.ps.home;
      const antibot = !h.verified ? antibotHTML(false)
        : Date.now() < (h.successUntil || 0) ? antibotHTML(true).replace('class="antibot is-ok"', 'class="antibot is-ok is-leaving"') : '';
      return {
        // 1.14.0: title and three-line text as the react-game Home; the anti-bot result right under the text
        left: { title: 'Epic Adventures Await', img: HOME_IMG, type: 'Home',
          desc: '<p>Branching narratives. Infinite choices. Every decision opens a new path: explore living worlds, '
            + 'face their dangers and write a story that is yours alone.</p>'
            + (antibot ? `<div class="home-intro-antibot">${antibot}</div>` : ''),
          tip: 'New here? The tutorial teaches cards, energy and missions in a few pages.',
          credits: { story: 'Paths Games — a web gamebook by the Paths Games team.',
            image: 'Photo: Lili Popper on Unsplash.', imageUrl: 'https://unsplash.com/photos/gray-and-white-pathway-between-green-plants-on-vast-valley-lu15z1m_KfM' },
          // the tutorial button alone at the card's foot, larger and centred (1.14.0)
          extra: '<div class="left-center"><button type="button" class="btn-book btn-book--big" data-left="tutorial">'
            + '<i class="fas fa-graduation-cap"></i> Play the tutorial</button></div>' },
        head: { text: 'Stories', icon: 'fa-book-open' },
        cards: STORIES.map(s => ({
          title: s.title, type: 'Story', category: s.category, icon: s.icon, c1: s.c1, c2: s.c2, desc: s.desc,
          status: s.match === 'completed' ? { icon: 'fa-check-circle', text: 'Completed' } : null,
          lock: s.soon ? () => 'Coming soon' : null,
          label: s.match === 'active' ? 'Resume' : s.match === 'completed' ? 'Replay' : 'Play',
          btnIcon: s.match === 'completed' ? 'fa-redo' : 'fa-play',
          play: true,
          act: () => ({ nav: s.match === 'active' ? `#/play/${s.id}` : `#/story/${s.id}` }),
        })),
      };
    },
    leftAct(name) { if (name === 'tutorial') return navigate('#/story/tutorial'); return null; },
  };

  const STORY = {
    enter(id) {
      app.story = storyById(id);
      app.config[id] = app.config[id] || { ...DEFAULT_CONFIG };
      app.ps.story = { view: 'config' };
    },
    spread() {
      const s = app.story;
      const cfg = app.config[s.id];
      const view = app.ps.story.view;
      if (view === 'config') {
        const option = type => {
          const o = optionOf(type, cfg[type]);
          return { title: o.title, type: OPTIONS[type].label, icon: o.icon, c1: o.c1, c2: o.c2, desc: o.desc,
            titleBadges: statBadges(o.stats), label: 'Change', btnIcon: 'fa-sync-alt',
            act: () => { app.ps.story.view = type; return { turn: 'fwd' }; } };
        };
        return {
          left: storyLeft(s, { back: true }),
          head: { text: 'Start your Adventure', icon: 'fa-scroll' },
          cards: [option('class'), option('character'), attributesCard(cfg), option('trait'), option('difficulty'),
            { ...heroCard(cfg), label: 'Start', btnIcon: 'fa-play', play: true, act: () => ({ nav: `#/start/${s.id}` }) }],
        };
      }
      const def = OPTIONS[view];
      const sel = optionOf(view, cfg[view]);
      return {
        left: { title: `Choose your ${def.label.toLowerCase()}`, icon: sel.icon, c1: sel.c1, c2: sel.c2, back: true,
          desc: `<p class="lead">${sel.title}</p><p>${sel.desc}</p>`, badges: statBadges(sel.stats), type: def.label,
          credits: { story: storyCredit(s) } },
        head: { text: def.label, icon: def.icon },
        cards: def.list.map(o => ({
          title: o.title, type: def.label, icon: o.icon, c1: o.c1, c2: o.c2, desc: o.desc, titleBadges: statBadges(o.stats),
          lock: o.lock ? () => o.lock : null,
          lockIcon: view === 'trait' ? 'fa-balance-scale' : 'fa-ban',
          selected: () => cfg[view] === o.id,
          label: () => (cfg[view] === o.id ? 'Selected' : 'Select'),
          act: () => { cfg[view] = o.id; app.ps.story.view = 'config'; return { turn: 'back' }; },
        })),
      };
    },
    back() {
      if (app.ps.story.view !== 'config') { app.ps.story.view = 'config'; return runTurn('back'); }
      return navigate('#/');
    },
  };

  const START = {
    enter(id) {
      app.story = storyById(id);
      app.config[id] = app.config[id] || { ...DEFAULT_CONFIG };
      app.ps.start = { verified: false, terms: false, phase: -1 };
      // v1.15.0 (owner): the success line leaves after 4 s, as on the Home
      setTimeout(() => {
        app.ps.start.verified = true;
        app.ps.start.successUntil = Date.now() + 4000;
        refreshSoon('start');
        setTimeout(() => refreshSoon('start'), 4050);
      }, 1500);
    },
    spread() {
      const s = app.story;
      const cfg = app.config[s.id];
      const st = app.ps.start;
      const left = storyLeft(s, {
        back: st.phase < 0,
        desc: '<p class="lead">Start your Adventure</p><p>One last look before the first page: game type, account and terms. '
          + 'Then the match is created and the book opens on its first location.</p>',
        extra: () => (!st.verified ? antibotHTML(false)
          : Date.now() < (st.successUntil || 0) ? antibotHTML(true).replace('class="antibot is-ok"', 'class="antibot is-ok is-leaving"') : ''),
      });
      if (st.phase < 0) {
        return {
          left, head: { text: 'Start your Adventure', icon: 'fa-flag' },
          cards: [
            { title: s.title, type: 'Story', icon: s.icon, c1: s.c1, c2: s.c2, desc: s.desc,
              label: 'Back', btnIcon: 'fa-arrow-left', act: () => ({ nav: `#/story/${s.id}` }) },
            { title: 'Single player', type: 'Type', icon: 'fa-user', c1: '#5c3317', c2: '#1a0a02',
              desc: 'Embark on a solo journey through the story. Multiplayer mode coming soon!', note: { icon: 'fa-lock', text: 'Locked' } },
            attributesCard(cfg),
            { title: 'Guest', type: 'Login', icon: 'fa-user-circle', c1: '#3b3a6b', c2: '#0d0b1e',
              desc: 'You can keep playing as a guest, signing in to keep your progress for the future.',
              label: 'Login', btnIcon: 'fa-sign-in-alt', act: () => ({ toast: 'Google sign-in opens here (concept)' }) },
            { title: 'Terms', type: 'Terms', icon: 'fa-file-contract', c1: '#6b5c4a', c2: '#1a140e', infoChapter: 'terms',
              selected: () => st.terms, label: () => (st.terms ? 'Accepted' : 'Accept'), btnIcon: () => (st.terms ? 'fa-check' : 'fa-hand-pointer'),
              act: () => { st.terms = !st.terms; return { refresh: true }; } },
            { ...heroCard(cfg), label: 'Start', btnIcon: 'fa-play', play: true,
              lock: () => (!st.verified ? 'Checking…' : !st.terms ? 'Accept the terms first' : null),
              act: () => ({ run: runPhases }) },
          ],
        };
      }
      const phase = (title, icon, i) => ({
        title, type: 'Phase', icon, c1: '#5c3317', c2: '#1a0a02', info: false,
        note: () => (st.phase > i ? { icon: 'fa-check', text: 'Complete' }
          : st.phase === i ? { icon: 'fa-spinner fa-spin', text: 'In progress' } : { icon: 'fa-hourglass-half', text: 'Pending' }),
      });
      return {
        left, head: { text: 'Bringing the match to life', icon: 'fa-cogs' },
        cards: [
          { title: s.title, type: 'Story', icon: s.icon, c1: s.c1, c2: s.c2, info: false, note: { icon: 'fa-check', text: 'Starting' } },
          { ...attributesCard(cfg), info: false }, { ...heroCard(cfg), info: false },
          phase('Creating', 'fa-hammer', 0), phase('Joining', 'fa-user-plus', 1), phase('Running', 'fa-door-open', 2),
        ],
      };
    },
    back() { return navigate(`#/story/${app.story.id}`); },
  };

  async function runPhases() {
    const st = app.ps.start;
    st.phase = 0;
    await turn('fwd');
    deal();
    if (animated(fx.deal)) await wait(T.deal + T.dealStep * 5);
    for (let i = 0; i < 3; i++) {
      st.phase = i;
      refreshFooters();
      await wait(Math.max(500, fx.latency));
    }
    st.phase = 3;
    refreshFooters();
    await wait(400);
    // the start page replaces its own history entry: Back from the game returns to the story set-up
    await navigate(`#/play/${app.story.id}`, true);
  }

  /* the game */
  function newGame(id) {
    return { story: id, view: 'board', page: 'crossroads', hasKey: false, items: { bread: true },
      visited: new Set(['crossroads']), life: 8, lifeMax: 10, energy: 6, energyMax: 10, sadness: 1, sadnessMax: 5, missionsSeen: 0 };
  }
  const weight = g => (g.items.bread ? 1 : 0) + 2 + (g.hasKey ? 1 : 0);
  const missionsDone = g => [g.hasKey || g.visited.has('tower'), g.visited.has('tower'), g.visited.has('ring')].filter(Boolean).length;
  const DONE = { icon: 'fa-check-circle', text: 'Done' };
  const OPEN = { icon: 'fa-hourglass-half', text: 'In progress' };

  const GAME_VIEWS = {
    board: g => {
      const p = PLACES[g.page];
      return {
        left: { title: p.title, icon: p.icon, c1: p.c1, c2: p.c2, desc: `<p>${p.desc}</p>`, type: 'Location',
          tip: TIPS.Location, credits: { story: storyCredit(app.story) } },
        head: { text: 'What will you do?', icon: 'fa-scroll' },
        cards: p.cards.map(c => ({
          ...c,
          desc: c.desc || (c.to ? PLACES[c.to].desc : ''),
          label: c.type === 'Movement' ? 'Go' : 'Play',
          lock: () => (c.lock && c.lock(g)) || (c.cost && g.energy < c.cost ? 'Not enough energy' : null),
          play: true,
          act: c.to ? () => {
            g.energy = Math.max(0, g.energy - (c.cost || 0));
            if (c.effect) c.effect(g);
            g.page = c.to;
            g.view = 'board';
            if (PLACES[c.to].place) g.visited.add(c.to);
            return { turn: c.back ? 'back' : 'fwd' };
          } : null,
        })),
      };
    },
    info: g => ({
      left: { title: 'Bran the Wanderer', icon: 'fa-user-shield', c1: '#7a4520', c2: '#1a0a02', type: 'Information', tip: TIPS.Stat,
        badges: [{ icon: 'fa-heart', text: `${g.life}/${g.lifeMax}` }, { icon: 'fa-bolt', text: `${g.energy}/${g.energyMax}` }, { icon: 'fa-sad-tear', text: `${g.sadness}/${g.sadnessMax}` }],
        desc: '<p>A traveller with good boots, a short temper and a long memory. The cards on the right are what is left of him today.</p>' },
      head: { text: 'Statistics', icon: 'fa-info-circle' },
      cards: [
        { title: 'Life', type: 'Stat', icon: 'fa-heart', c1: '#9b2c2c', c2: '#2a0808', desc: 'At zero the hero falls into a coma.',
          note: () => ({ icon: 'fa-heart', text: `${g.life} / ${g.lifeMax}` }) },
        { title: 'Energy', type: 'Stat', icon: 'fa-bolt', c1: '#b8860b', c2: '#2e1a02', desc: 'Every road and action costs some; sleep gives it back.',
          note: () => ({ icon: 'fa-bolt', text: `${g.energy} / ${g.energyMax}` }) },
        { title: 'Sadness', type: 'Stat', icon: 'fa-sad-tear', c1: '#3a5a78', c2: '#0b1622', desc: 'Bad news piles up here; at the top it costs a life.',
          note: () => ({ icon: 'fa-cloud-rain', text: `${g.sadness} / ${g.sadnessMax}` }) },
        { title: 'Experience', type: 'Stat', icon: 'fa-star', c1: '#6b4fa0', c2: '#160d2a', desc: 'Spent in safe places to train a statistic.',
          note: { icon: 'fa-star', text: '3' } },
      ],
    }),
    backpack: g => ({
      left: { title: 'Backpack', icon: 'fa-suitcase', c1: '#8a5a2b', c2: '#1a0a02', type: 'Backpack', tip: TIPS.Item,
        badges: [{ icon: 'fa-weight-hanging', text: `${weight(g)}/10` }],
        desc: '<p>Everything you carry, wrapped in an old cloak. Using an item closes the backpack and brings you back to the board.</p>' },
      head: { text: 'Your items', icon: 'fa-suitcase' },
      cards: [
        g.items.bread && { title: 'Bread', type: 'Item', icon: 'fa-bread-slice', c1: '#c08040', c2: '#3a1d0b', label: 'Use', play: true,
          desc: 'Gives back 3 energy.', badges: [{ icon: 'fa-bolt', text: '+3' }, { icon: 'fa-weight-hanging', text: 1 }],
          act: () => { g.items.bread = false; g.energy = Math.min(g.energyMax, g.energy + 3); g.view = 'board'; return { turn: 'back' }; },
          actions: [{ label: 'Drop', icon: 'fa-trash-alt', act: () => { g.items.bread = false; return { rerender: true }; } }] },
        { title: 'Torch', type: 'Item', icon: 'fa-fire', c1: '#d44a0a', c2: '#2a0a02', lock: () => 'Only in the dark',
          desc: 'Useful where the sun does not reach.', badges: [{ icon: 'fa-weight-hanging', text: 2 }] },
        g.hasKey && { title: 'Iron key', type: 'Item', icon: 'fa-key', c1: '#6b5c4a', c2: '#1a140e', desc: 'Cold and covered in moss.',
          note: { icon: 'fa-chess-rook', text: 'Opens the tower' } },
      ].filter(Boolean),
    }),
    map: g => ({
      left: { title: 'Map', icon: 'fa-map', c1: '#7a6a3a', c2: '#1a140a', type: 'Map',
        desc: '<p>The places you have seen are drawn in ink; the rest is still fog. Pick one to travel there.</p>' },
      head: { text: 'Places you know', icon: 'fa-map' },
      cards: Object.keys(PLACES).filter(id => PLACES[id].place && g.visited.has(id)).map(id => ({
        title: PLACES[id].title, type: 'Location', to: id, desc: PLACES[id].desc, label: 'Go', play: true,
        note: id === g.page ? { icon: 'fa-map-marker-alt', text: 'You are here' } : null,
        act: () => { g.page = id; g.view = 'board'; return { turn: 'fwd' }; },
      })),
    }),
    missions: g => ({
      left: { title: 'Missions', icon: 'fa-clipboard-list', c1: '#5c3317', c2: '#1a0a02', type: 'Missions',
        desc: '<p>What the valley asked of you. A mission closes by itself when its last step is done.</p>' },
      head: { text: 'Your missions', icon: 'fa-clipboard-list' },
      cards: [
        { title: 'Find the key', type: 'Mission', icon: 'fa-key', c1: '#3a5a78', c2: '#0b1622', desc: 'The miller knows where it fell.',
          note: g.hasKey || g.visited.has('tower') ? DONE : OPEN },
        { title: 'Open the tower', type: 'Mission', icon: 'fa-chess-rook', c1: '#6b5c4a', c2: '#1a140e', desc: 'Nobody has opened it in years.',
          note: g.visited.has('tower') ? DONE : OPEN },
        { title: 'Meet the fairies', type: 'Mission', icon: 'fa-hat-wizard', c1: '#4b3a8a', c2: '#0e0a24', desc: 'Follow the blue lights.',
          note: g.visited.has('ring') ? DONE : OPEN },
      ],
    }),
    close: g => ({
      left: { title: 'Close the book', icon: 'fa-door-open', c1: '#5c3317', c2: '#1a0a02', back: true,
        desc: '<p>Your match is saved at every page: you can come back to it from the Home whenever you want.</p>' },
      head: { text: 'Leave the match?', icon: 'fa-door-open' },
      cards: [
        { title: 'Leave', type: 'Exit', icon: 'fa-door-open', c1: '#7a4520', c2: '#1a0a02', info: false, label: 'Leave', btnIcon: 'fa-home',
          act: () => ({ nav: '#/' }) },
        { title: 'Keep playing', type: 'Back', icon: 'fa-book-open', c1: '#4f6b2a', c2: '#101a06', info: false, label: 'Stay', btnIcon: 'fa-arrow-left',
          act: () => { g.view = 'board'; return { turn: 'back' }; } },
      ],
    }),
  };

  const GAME = {
    enter(id) {
      app.story = storyById(id);
      if (!app.game || app.game.story !== id) app.game = newGame(id);
      app.game.view = 'board';
    },
    spread() { return GAME_VIEWS[app.game.view](app.game); },
    bookmarks() {
      const g = app.game;
      return [
        { key: 'board', icon: 'fa-map-marker-alt', label: 'Position', active: g.view === 'board' },
        { key: 'info', icon: 'fa-info-circle', label: 'Information', active: g.view === 'info',
          danger: g.energy <= 2 || g.life <= 2,
          badges: [{ icon: 'fa-heart', text: `${g.life}/${g.lifeMax}` }, { icon: 'fa-bolt', text: `${g.energy}/${g.energyMax}` },
            { icon: 'fa-sad-tear', text: `${g.sadness}/${g.sadnessMax}` }] },
        { key: 'backpack', icon: 'fa-suitcase', label: 'Backpack', active: g.view === 'backpack',
          danger: weight(g) > 10, // as 1.14.0 isBagOverloaded: red over the weight limit
          badges: [{ icon: 'fa-weight-hanging', text: `${weight(g)}/10` }] },
        { key: 'map', icon: 'fa-map', label: 'Map', active: g.view === 'map' },
        { key: 'missions', icon: 'fa-clipboard-list', label: 'Missions', active: g.view === 'missions',
          alert: missionsDone(g) > g.missionsSeen },
      ];
    },
    tab(key) {
      const g = app.game;
      if (g.view === key) return null;
      const from = GAME_TABS.indexOf(g.view);
      const dir = from < 0 || GAME_TABS.indexOf(key) > from ? 'fwd' : 'back';
      g.view = key;
      if (key === 'missions') g.missionsSeen = missionsDone(g);
      return runTurn(dir);
    },
    back() {
      if (app.game.view === 'board') return null;
      app.game.view = 'board';
      return runTurn('back');
    },
    close() {
      if (app.game.view === 'close') return null;
      app.game.view = 'close';
      return runTurn('fwd');
    },
  };

  const CONTROLLERS = { home: HOME, story: STORY, start: START, game: GAME };
  const controller = () => CONTROLLERS[app.route.page];

  function chapterSpread(kind) {
    const p = POLICIES[kind];
    return {
      left: { title: p.title, icon: p.icon, c1: '#5c3317', c2: '#1a0a02', back: true,
        desc: '<p>A chapter of this book: the page you were reading waits behind it. The address does not change.</p>' },
      head: { text: p.title, icon: p.icon },
      text: p.text,
    };
  }
  const currentSpread = () => (app.chapter ? chapterSpread(app.chapter) : controller().spread());

  /* ═══════════════ routing: one book per page (no turn between pages) ═══════════════ */
  function parseRoute() {
    const [page, id] = location.hash.replace(/^#\/?/, '').split('/');
    if (page === 'story' && storyById(id)) return { page: 'story', id };
    if (page === 'start' && storyById(id)) return { page: 'start', id };
    if (page === 'play' && storyById(id)) return { page: 'game', id };
    return { page: 'home' };
  }

  function navigate(hash, replace = false) {
    if (location.hash !== hash) {
      app.ignoreHash = true;
      if (replace) location.replace(hash); else location.hash = hash;
    }
    return openRoute();
  }

  /* Between pages: v1.15.0 (owner) — whenever the book changes (the Home book: Home and the player page; the story's
     book: set-up, start match, game) this book closes and the next one opens; every other change of page turns the
     page (forward towards the game, back otherwise). With the cover off the new book just appears. */
  const BOOK_OF = { home: 'home', story: 'story', start: 'story', game: 'story' };
  const RANK = { home: 0, story: 1, start: 2, game: 3 };

  async function openRoute(first = false) {
    setBusy(true);
    stopDeal();
    const from = app.route.page;
    const to = parseRoute();
    const enter = () => {
      app.route = to;
      app.preview = null;
      app.chapter = null;
      controller().enter(to.id);
    };
    const swap = !first && BOOK_OF[from] !== BOOK_OF[to.page];
    if (first || (swap ? !animated(fx.cover) : !animated(fx.turn))) {
      enter();
      render(currentSpread());
      renderBookmarks();
      window.scrollTo(0, 0);
      if (first && animated(fx.cover)) {
        restartAnimation(els.shell, 'is-opening');
        await wait(T.open);
        els.shell.classList.remove('is-opening');
      }
    } else if (swap) {
      await swapBook(enter);
    } else {
      if (!isMobile()) window.scrollTo(0, 0);
      enter();
      await turn(RANK[to.page] > RANK[from] ? 'fwd' : 'back');
    }
    setBusy(false);
    deal();
  }

  /* ═══════════════ close this book, open another one ═══════════════ */
  const coverTitle = () => (app.route.page !== 'home' && app.story ? app.story.title : 'Paths Games');
  const coverSub = title => (title === 'Paths Games' ? 'Web gamebook' : 'Paths Games');
  const coverHTML = title => '<div class="cover-frame"></div><i class="fas fa-dice-d20 cover-d20"></i>'
    + `<div class="cover-title">${title}</div><div class="cover-sub">${coverSub(title)}</div>`;
  /* the right half of the open book (cover and right page), as the face of the folding flap */
  function rightHalf() {
    const face = document.createElement('div');
    face.className = 'flap-face flap-front';
    const copy = els.book.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    copy.classList.add('flap-copy');
    const w = els.book.offsetWidth;
    Object.assign(copy.style, { clipPath: '', width: w + 'px', height: els.book.offsetHeight + 'px', left: -(w / 2) + 'px' });
    face.append(copy, shade());
    return face;
  }

  /* v1.15.0 (owner): a book change lasts at most fx.coverMax (planned VITE_ANIM_COVER_MAX_S, default 10 s): when the
     speed would make it longer, all its phases shrink together; at 1× it stays 3.4 s (desktop), 2.4 s (phone). */
  function swapTimes() {
    const total = fx.turnMode !== 'full' ? T.close + T.open
      : isMobile() ? 2 * (T.sheet + T.slide) : 2 * (T.fade + T.flip + T.slide);
    const k = fx.coverMax > 0 ? Math.min(1, fx.coverMax / total) : 1;
    const S = {};
    for (const key of ['open', 'close', 'fade', 'flip', 'slide', 'sheet']) S[key] = Math.round(T[key] * k);
    return S;
  }

  async function swapBook(enter) {
    const T = swapTimes(); // the capped durations shadow the global ones inside the book change
    if (fx.turnMode !== 'full') { // simple mode: the book fades out and the next one opens
      restartAnimation(els.shell, 'is-closing');
      await wait(T.close);
      enter();
      render(currentSpread());
      renderBookmarks();
      window.scrollTo(0, 0);
      els.shell.classList.remove('is-closing');
      restartAnimation(els.shell, 'is-opening');
      await wait(T.open);
      els.shell.classList.remove('is-opening');
      return;
    }
    if (isMobile()) { await mobileSwap(enter, T); return; }
    window.scrollTo(0, 0);
    const tabs = (a, b) => els.bookmarks.animate([{ opacity: a }, { opacity: b }], { duration: T.fade, fill: 'forwards' }).finished;
    const half = T.flip / 2;
    const ease = 'cubic-bezier(.45,.05,.3,1)';
    const flap = document.createElement('div');
    flap.className = 'book-flap';
    const front = rightHalf();
    const cover = document.createElement('div');
    cover.className = 'flap-face flap-back cover-face';
    cover.innerHTML = coverHTML(coverTitle());
    const coverShade = cover.appendChild(shade());
    flap.append(front, cover);
    await tabs(1, 0);
    els.book.style.clipPath = 'inset(-60px 50% -80px -60px)'; // only the left half stays: the right one is the flap
    els.shell.appendChild(flap);
    // 1. the right half folds over the spine: the book is closed, its cover up
    const closing = flap.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], { duration: T.flip, easing: ease, fill: 'forwards' });
    $('.flip-shade', front).animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: half, easing: 'ease-in', fill: 'forwards' });
    coverShade.animate([{ opacity: 0.55 }, { opacity: 0 }], { delay: half, duration: half, fill: 'both' });
    await closing.finished;
    // 2. the closed book slides out to the left; the new one, already closed, comes in from the right
    const r = els.book.getBoundingClientRect();
    const out = -(r.left + r.width / 2 + 80);
    const inn = window.innerWidth - r.left + 80;
    const slide = (from, to, easing) => Promise.all([
      els.book.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
        { duration: T.slide, easing, fill: 'forwards' }).finished,
      flap.animate([{ transform: `translateX(${from}px) rotateY(-180deg)` }, { transform: `translateX(${to}px) rotateY(-180deg)` }],
        { duration: T.slide, easing, fill: 'forwards' }).finished,
    ]);
    await slide(0, out, 'cubic-bezier(.55,.05,.85,.45)');
    enter();
    render(currentSpread());
    renderBookmarks();
    $('.cover-title', cover).textContent = coverTitle();
    $('.cover-sub', cover).textContent = coverSub(coverTitle());
    const newFront = rightHalf();
    front.replaceWith(newFront);
    await slide(inn, 0, 'cubic-bezier(.15,.55,.45,.95)');
    els.book.getAnimations().forEach(a => a.cancel());
    // 3. the cover opens on the new book
    flap.getAnimations().forEach(a => a.cancel());
    const opening = flap.animate([{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }], { duration: T.flip, easing: ease, fill: 'forwards' });
    coverShade.animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: half, easing: 'ease-in', fill: 'forwards' });
    $('.flip-shade', newFront).animate([{ opacity: 0.55 }, { opacity: 0 }], { delay: half, duration: half, fill: 'both' });
    await opening.finished;
    els.book.style.clipPath = '';
    flap.remove();
    await tabs(0, 1);
    els.bookmarks.getAnimations().forEach(a => a.cancel());
  }

  /* mobile: the cover closes over the page from its left edge, then opens on the new book */
  async function mobileSwap(enter, T) {
    document.documentElement.classList.add('is-turning');
    const cover = document.createElement('div');
    cover.className = 'm-sheet cover-face m-cover';
    Object.assign(cover.style, px(visibleSlice()));
    cover.innerHTML = coverHTML(coverTitle());
    const coverShade = cover.appendChild(shade());
    document.body.appendChild(cover);
    const opts = { duration: T.sheet, fill: 'forwards' };
    coverShade.animate([{ opacity: 0.6 }, { opacity: 0 }], opts);
    await cover.animate([{ transform: 'perspective(1400px) rotateY(-90deg)' },
      { transform: 'perspective(1400px) rotateY(0deg)' }], { ...opts, easing: 'cubic-bezier(.15,.55,.45,.95)' }).finished;
    // the closed book slides out to the left, the new one comes in from the right (the page waits hidden)
    els.book.style.visibility = 'hidden';
    const slide = (from, to, easing) => cover.animate([
      { transform: `perspective(1400px) translateX(${from}) rotateY(0deg)` },
      { transform: `perspective(1400px) translateX(${to}) rotateY(0deg)` }], { duration: T.slide, easing, fill: 'forwards' }).finished;
    await slide('0px', '-110vw', 'cubic-bezier(.55,.05,.85,.45)');
    enter();
    render(currentSpread());
    renderBookmarks();
    window.scrollTo(0, 0);
    $('.cover-title', cover).textContent = coverTitle();
    $('.cover-sub', cover).textContent = coverSub(coverTitle());
    await slide('110vw', '0px', 'cubic-bezier(.15,.55,.45,.95)');
    els.book.style.visibility = '';
    cover.getAnimations().forEach(a => a.cancel());
    coverShade.animate([{ opacity: 0 }, { opacity: 0.6 }], opts);
    await cover.animate([{ transform: 'perspective(1400px) rotateY(0deg)' },
      { transform: 'perspective(1400px) rotateY(-90deg)' }], { ...opts, easing: 'cubic-bezier(.55,.05,.85,.45)' }).finished;
    cover.remove();
    document.documentElement.classList.remove('is-turning');
  }

  /* ═══════════════ 1 — DEAL: each card leaves the deck when it enters the screen ═══════════════ */
  function stopDeal() {
    if (dealObserver) dealObserver.disconnect();
    dealObserver = null;
  }

  function deal() {
    stopDeal();
    const cards = cardEls();
    if (!animated(fx.deal)) {
      cards.forEach(c => c.classList.remove('pre-deal'));
      return;
    }
    const pending = cards.filter(c => c.classList.contains('pre-deal'));
    if (pending.length === 0) return;
    if (!('IntersectionObserver' in window)) {
      dealBatch(pending);
      return;
    }
    const io = new IntersectionObserver(entries => {
      const batch = entries.filter(e => e.isIntersecting).map(e => e.target)
        .sort((a, b) => cards.indexOf(a) - cards.indexOf(b));
      batch.forEach(c => io.unobserve(c));
      if (batch.length) dealBatch(batch);
    }, { threshold: 0.2 });
    pending.forEach(c => io.observe(c));
    dealObserver = io;
  }

  function dealBatch(batch) {
    // desktop: the top card of the pile on the table; mobile: the sticky deck in the page (read it now)
    const pile = $('#deck-pile');
    const from = !isMobile() && pile && pile.offsetParent ? $('.deck-pile__top', pile) : $('.deck', els.right);
    const deck = from.getBoundingClientRect();
    const deckX = deck.left + deck.width / 2;
    const deckY = deck.top + deck.height / 2;
    batch.forEach((card, n) => {
      const i = Math.min(n, MAX_STAGGER - 1);
      const r = card.getBoundingClientRect(); // the slot: pre-deal only hides it
      card.style.setProperty('--i', i);
      card.style.setProperty('--from-x', (deckX - (r.left + r.width / 2)) + 'px');
      card.style.setProperty('--from-y', (deckY - (r.top + r.height / 2)) + 'px');
      card.style.setProperty('--from-rot', (Math.random() * 30 - 15).toFixed(1) + 'deg');
      card.classList.remove('pre-deal');
      card.classList.add('is-dealing', fx.faceDown ? 'deal-facedown' : 'deal-flat');
      let landed = false;
      const land = () => {
        if (landed) return;
        landed = true;
        card.classList.remove('is-dealing', 'deal-facedown', 'deal-flat');
      };
      card.addEventListener('animationend', e => { if (e.target === card) land(); });
      setTimeout(land, T.deal + T.dealStep * i + 200); // a safety net if animationend never comes
    });
  }

  function redeal() {
    if (app.busy || !animated(fx.deal)) return;
    cardEls().forEach(c => c.classList.add('pre-deal'));
    requestAnimationFrame(deal);
  }

  /* ═══════════════ 2 — PLAY: lift + glow while the server answers, then fly into the story ═══════════════ */
  function viewTop() {
    let top = els.navbar.getBoundingClientRect().bottom;
    if (isMobile() && !els.bookmarks.classList.contains('is-empty')) {
      top = Math.max(top, els.bookmarks.getBoundingClientRect().bottom);
    }
    return top;
  }
  function flightTarget() {
    if (!isMobile()) {
      const pic = $('.loc-img', els.left).getBoundingClientRect();
      return { x: pic.left + pic.width / 2, y: pic.top + pic.height / 2 };
    }
    return { x: window.innerWidth / 2, y: viewTop() + 60 };
  }

  function flyOut(cardEl) {
    const from = cardEl.getBoundingClientRect();
    const to = flightTarget();
    const clone = cardEl.cloneNode(true);
    clone.classList.remove('is-playing');
    clone.classList.add('flying-card');
    Object.assign(clone.style, px(from));
    clone.style.setProperty('--card-w', from.width + 'px');
    document.body.appendChild(clone);
    cardEl.style.visibility = 'hidden';
    const dx = to.x - (from.left + from.width / 2);
    const dy = to.y - (from.top + from.height / 2);
    const flight = clone.animate([
      { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 70}px) rotate(-10deg) scale(0.9)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) rotate(-16deg) scale(0.3)`, opacity: 0 },
    ], { duration: T.fly, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
    return flight.finished.then(() => clone.remove());
  }

  function discard(others) {
    others.forEach((el, j) => {
      el.style.setProperty('--j', j);
      el.style.setProperty('--drop-rot', (Math.random() * 10 - 5).toFixed(1) + 'deg');
      el.classList.add('is-discarded');
    });
    return others.length ? wait(T.discard + T.discardStep * others.length) : Promise.resolve();
  }

  async function onAct(index) {
    const card = app.cards[index];
    if (app.busy || !card || !card.act || val(card.lock)) return;
    const nodes = cardEls();
    const el = nodes[index];
    setBusy(true);
    stopDeal();
    let result;
    if (card.play) {
      const btn = $('[data-act]', el);
      if (btn) btn.innerHTML = SPINNER;
      vibrate();
      if (animated(fx.play)) {
        // a card still waiting on the deck stays there: it is turned away with the page
        const others = nodes.filter(c => c !== el && !c.classList.contains('pre-deal'));
        el.classList.add('is-playing');
        others.forEach(o => o.classList.add('is-dimmed'));
        await wait(Math.max(T.lift, fx.latency)); // the "server" call, hidden behind the glow
        result = card.act();
        await Promise.all([flyOut(el), discard(others)]);
      } else {
        await wait(fx.latency);
        result = card.act();
      }
    } else {
      result = card.act();
    }
    await applyResult(result);
    setBusy(false);
    deal();
  }

  async function applyResult(res) {
    if (!res) return;
    if (res.toast) toast(res.toast);
    if (res.refresh) refreshFooters();
    if (res.rerender) rerenderRight();
    if (res.turn) await turn(res.turn);
    if (res.run) await res.run();
    if (res.nav) await navigate(res.nav, res.replace);
  }

  async function runTurn(dir) {
    if (app.busy) return;
    setBusy(true);
    stopDeal();
    await turn(dir);
    setBusy(false);
    deal();
  }

  /* ═══════════════ (i) previews: fade in and fade out, on the left page (in the game: right page) ═══════════════ */
  async function fadeSwap(el, swap) {
    if (fx.reduced) { swap(); return; }
    await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, easing: 'ease-in', fill: 'forwards' }).finished;
    swap();
    await el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.fade, easing: 'ease-out', fill: 'forwards' }).finished;
    el.getAnimations().forEach(a => a.cancel());
  }
  function scrollToSide(side) {
    if (!isMobile()) return;
    // v1.15.0: the tabs stand on the book's top edge (no sticky bar), so every page change goes back to the very top
    if (side === 'left') { window.scrollTo(0, 0); return; }
    window.scrollTo(0, Math.max(0, window.scrollY + els.right.getBoundingClientRect().top - viewTop() - 8));
  }

  async function onInfo(index) {
    const card = app.cards[index];
    if (app.busy || !card) return;
    if (card.infoChapter) { openChapter(card.infoChapter); return; }
    const side = app.route.page === 'game' ? 'right' : 'left';
    const { icon, c1, c2 } = look(card);
    const lock = val(card.lock);
    const note = lock ? { icon: card.lockIcon || 'fa-lock', text: lock } : val(card.note);
    // the reading page of the card: the same action as its small card, in the page buttons bar
    const buttons = !lock && !note && card.act
      ? [{ label: val(card.label) || 'Play', icon: val(card.btnIcon), play: card.play, act: card.act }] : [];
    (card.actions || []).forEach(a => buttons.push(a));
    const page = { title: val(card.title), icon, c1, c2, back: true, type: card.type,
      desc: `<p>${card.desc || ''}</p>`, badges: val(card.badges) || val(card.titleBadges), tip: TIPS[card.type],
      credits: app.story ? { story: storyCredit(app.story) } : null,
      extra: note ? `<span class="pg-extra-note"><i class="fas ${note.icon}"></i> ${note.text}</span>` : null, buttons };
    setBusy(true);
    app.preview = { side };
    const inner = innerOf(side === 'left' ? els.left : els.right);
    await fadeSwap(inner, () => showPageCard(side, page));
    scrollToSide(side);
    setBusy(false);
  }

  async function closePreview() {
    const side = app.preview.side;
    app.preview = null;
    setBusy(true);
    const inner = innerOf(side === 'left' ? els.left : els.right);
    await fadeSwap(inner, () => {
      if (side === 'left') setLeft(app.spread);
      else {
        app.pageCard.right = null;
        inner.innerHTML = rightHTML(app.spread, { dealt: true }); // the cards are already on the page
      }
    });
    scrollToSide(side);
    setBusy(false);
  }

  /* the cards list again, without a new deal (a secondary action changed it) */
  function rerenderRight() {
    const S = currentSpread();
    app.spread = S;
    app.cards = S.cards || [];
    innerOf(els.right).innerHTML = rightHTML(S, { dealt: true });
    renderBookmarks();
  }

  /* a secondary CardButtons action (actionsList), e.g. dropping an item */
  async function onAct2(index, j) {
    const action = app.cards[index]?.actions?.[j];
    if (app.busy || !action) return;
    setBusy(true);
    await applyResult(action.act());
    setBusy(false);
  }

  /* the page CardButtons bar of a reading page: the page card glows while the server answers */
  async function onPageAct(side, j) {
    const b = app.pageCard[side]?.buttons?.[j];
    if (app.busy || !b) return;
    setBusy(true);
    stopDeal();
    let result;
    let pageEl = null;
    if (b.play) {
      vibrate();
      pageEl = $('.loc-page', innerOf(side === 'left' ? els.left : els.right));
      if (animated(fx.play) && pageEl) pageEl.classList.add('is-playing');
      await wait(animated(fx.play) ? Math.max(T.lift, fx.latency) : fx.latency);
    }
    result = b.act();
    // 1.14.0: the whole reading card flies to the story, as a small card does
    if (b.play && animated(fx.play) && pageEl?.isConnected) await flyOut(pageEl);
    if (app.preview && !(result && (result.turn || result.nav || result.run))) {
      app.preview = null; // nothing turns: the reading page simply fades back to the list
      await closePreviewAfter(side);
    }
    await applyResult(result);
    if (pageEl?.isConnected) { pageEl.style.visibility = ''; pageEl.classList.remove('is-playing'); } // nothing replaced it
    setBusy(false);
    deal();
  }
  async function closePreviewAfter(side) {
    const inner = innerOf(side === 'left' ? els.left : els.right);
    await fadeSwap(inner, () => {
      if (side === 'left') setLeft(currentSpread());
      else { app.pageCard.right = null; rerenderRight(); }
    });
  }

  /* ═══════════════ policy chapters: inside the current book, the address does not change ═══════════════ */
  async function openChapter(kind) {
    if (app.busy || app.chapter === kind) return;
    setBusy(true);
    stopDeal();
    window.scrollTo(0, 0);
    app.chapter = kind;
    await turn('fwd');
    setBusy(false);
  }
  async function closeChapter() {
    setBusy(true);
    app.chapter = null;
    await turn('back');
    setBusy(false);
    deal();
  }

  function onBack() {
    if (app.busy) return;
    if (app.preview) { closePreview(); return; }
    if (app.chapter) { closeChapter(); return; }
    const ctrl = controller();
    if (ctrl.back) ctrl.back();
  }

  /* ═══════════════ 3 — PAGE TURN: every change of spread inside a page ═══════════════ */
  function turn(dir) {
    app.preview = null;
    const spread = currentSpread();
    renderBookmarks();
    if (!animated(fx.turn)) {
      render(spread);
      if (isMobile()) scrollToSide('left');
      return Promise.resolve();
    }
    if (fx.turnMode !== 'full') return simpleTurn(spread, dir);
    return isMobile() ? mobileTurn(spread, dir) : fullTurn(spread, dir);
  }

  async function simpleTurn(spread, dir) {
    const left = innerOf(els.left);
    const right = innerOf(els.right);
    const enter = dir === 'back' ? 'page-enter-back' : 'page-enter';
    render(spread);
    scrollToSide('left');
    restartAnimation(left, 'page-fade');
    restartAnimation(right, enter);
    await wait(T.simple);
    left.classList.remove('page-fade');
    right.classList.remove(enter);
  }

  /* Desktop: a sheet hinged on the spine, the old page in front, the new one on its back.
     Forward turns the right page over to the left; back turns the left page to the right. */
  async function fullTurn(spread, dir) {
    const fwd = dir !== 'back';
    const sheet = fwd ? els.right : els.left; // the page that lifts, also what it uncovers

    const front = sheet.cloneNode(true);
    front.removeAttribute('id');
    front.classList.add('flip-front');
    const back = document.createElement('section');
    back.className = 'book-page flip-back ' + (fwd ? 'book-page-left' : 'book-page-right');
    back.innerHTML = fwd
      ? `<div class="page-inner">${leftHTML(spread.left, 'flip')}</div>`
      : `<div class="page-inner">${rightHTML(spread, { withCards: false })}</div>${DECK}`;
    const frontShade = front.appendChild(shade());
    const backShade = back.appendChild(shade());

    const flipper = document.createElement('div');
    flipper.className = 'page-flipper ' + (fwd ? 'is-fwd' : 'is-back');
    flipper.append(front, back);

    // same task as the append: no frame ever shows the new page uncovered
    if (fwd) setRight(spread); else setLeft(spread);
    const cast = document.createElement('div');
    cast.className = 'turn-shadow ' + (fwd ? 'from-left' : 'from-right');
    sheet.appendChild(cast);
    els.pages.appendChild(flipper);

    const half = T.flip / 2;
    const turning = flipper.animate(
      [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${fwd ? -180 : 180}deg)` }],
      { duration: T.flip, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
    frontShade.animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: half, easing: 'ease-in', fill: 'forwards' });
    backShade.animate([{ opacity: 0.55 }, { opacity: 0 }], { delay: half, duration: half, easing: 'ease-out', fill: 'both' });
    cast.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: T.flip, easing: 'ease-out', fill: 'forwards' });

    await turning.finished;
    if (fwd) setLeft(spread); else setRight(spread);
    flipper.remove();
    cast.remove();
  }

  /* Mobile: one page bound on its left edge. Only the part on screen is copied on a fixed sheet
     (a whole tall page would turn badly); the jump back to the top happens under it, unseen. */
  function visibleSlice() {
    const book = els.book.getBoundingClientRect();
    const top = Math.max(viewTop(), book.top);
    const bottom = Math.min(window.innerHeight, book.bottom);
    return { left: book.left, top, width: book.width, height: Math.max(0, bottom - top), book };
  }
  function snapshot(slice) {
    const layer = document.createElement('div');
    layer.className = 'm-sheet';
    Object.assign(layer.style, px(slice));
    const copy = els.book.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    copy.classList.add('m-sheet__book');
    Object.assign(copy.style, { left: '0px', top: (slice.book.top - slice.top) + 'px', width: slice.book.width + 'px' });
    layer.appendChild(copy);
    return layer;
  }

  async function mobileTurn(spread, dir) {
    const fwd = dir !== 'back';
    const layers = [];
    const add = el => { document.body.appendChild(el); layers.push(el); return el; };
    const castOver = slice => {
      const c = document.createElement('div');
      c.className = 'm-cast';
      Object.assign(c.style, px(slice));
      return add(c);
    };
    const opts = { duration: T.sheet, fill: 'forwards' };
    document.documentElement.classList.add('is-turning');
    let turning;
    if (fwd) {
      const slice = visibleSlice();
      const sheet = snapshot(slice);
      const sheetShade = sheet.appendChild(shade());
      render(spread);
      scrollToSide('left');
      const cast = castOver(slice);
      add(sheet);
      turning = sheet.animate([{ transform: 'perspective(1400px) rotateY(0deg)' },
        { transform: 'perspective(1400px) rotateY(-90deg)' }], { ...opts, easing: 'cubic-bezier(.55,.05,.85,.45)' });
      sheetShade.animate([{ opacity: 0 }, { opacity: 0.6 }], { ...opts, easing: 'ease-in' });
      cast.animate([{ opacity: 0.55 }, { opacity: 0 }], { ...opts, easing: 'ease-out' });
    } else {
      add(snapshot(visibleSlice())); // the old page stays still underneath
      render(spread);
      scrollToSide('left');
      const slice = visibleSlice();
      const cast = castOver(slice);
      const sheet = add(snapshot(slice));
      const sheetShade = sheet.appendChild(shade());
      turning = sheet.animate([{ transform: 'perspective(1400px) rotateY(-90deg)' },
        { transform: 'perspective(1400px) rotateY(0deg)' }], { ...opts, easing: 'cubic-bezier(.15,.55,.45,.95)' });
      sheetShade.animate([{ opacity: 0.6 }, { opacity: 0 }], { ...opts, easing: 'ease-out' });
      cast.animate([{ opacity: 0 }, { opacity: 0.55 }], { ...opts, easing: 'ease-in' });
    }
    await turning.finished;
    layers.forEach(l => l.remove());
    document.documentElement.classList.remove('is-turning');
  }

  /* ═══════════════ events ═══════════════ */
  /* Tooltip of every [data-tip]: one fixed element over everything (navbar and cover included),
     above the target when there is room under the navbar, otherwise below; kept on screen. */
  const tip = document.createElement('div');
  tip.className = 'pg-tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  let tipTarget = null;
  function showTip(el) {
    if (tipTarget === el) return;
    tipTarget = el;
    tip.textContent = el.dataset.tip;
    tip.classList.remove('is-on', 'is-below', 'is-left', 'is-right');
    tip.style.visibility = 'hidden';
    tip.classList.add('is-on');
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    // v1.15.0 — a side tab (desktop only, all on the right) shows its tip on its left, over the cover; tablets and phones keep above / below.
    const side = isSideTabs() && el.dataset.tipSide;
    const sideX = side === 'right' ? r.right + 10 : r.left - w - 10;
    if (side && sideX >= 8 && sideX + w <= window.innerWidth - 8) {
      const top = Math.min(Math.max(8, r.top + r.height / 2 - h / 2), window.innerHeight - h - 8);
      tip.classList.add(side === 'right' ? 'is-right' : 'is-left');
      tip.style.left = sideX + 'px';
      tip.style.top = top + 'px';
      tip.style.setProperty('--arrow-y', (r.top + r.height / 2 - top) + 'px');
      tip.style.visibility = '';
      restartAnimation(tip, 'is-on');
      return;
    }
    const below = el.dataset.tipPos === 'below' || r.top - h - 10 < els.navbar.getBoundingClientRect().bottom;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    tip.classList.toggle('is-below', below);
    tip.style.left = left + 'px';
    tip.style.top = (below ? r.bottom + 10 : r.top - h - 10) + 'px';
    tip.style.setProperty('--arrow-x', (r.left + r.width / 2 - left) + 'px');
    tip.style.visibility = '';
    restartAnimation(tip, 'is-on');
  }
  function hideTip() {
    tipTarget = null;
    tip.classList.remove('is-on');
  }
  if (window.matchMedia('(hover: hover)').matches) { // hover devices; touch screens use a long press (below)
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-tip]');
      if (t) showTip(t); else if (tipTarget) hideTip();
    });
  }
  // touch screens: a long press shows the tip; the click that follows it is swallowed
  let pressTimer = null;
  let pressShown = false;
  document.addEventListener('touchstart', e => {
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    pressShown = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { pressShown = true; showTip(t); }, 500);
  }, { passive: true });
  const endPress = () => {
    clearTimeout(pressTimer);
    if (pressShown) setTimeout(hideTip, 1500);
  };
  document.addEventListener('touchend', endPress, { passive: true });
  document.addEventListener('touchmove', () => { clearTimeout(pressTimer); }, { passive: true });
  document.addEventListener('contextmenu', e => { if (e.target.closest('[data-tip]')) e.preventDefault(); });
  document.addEventListener('click', e => {
    if (!pressShown) return;
    pressShown = false;
    e.preventDefault();
    e.stopImmediatePropagation(); // nor the tab, nor the listener that would hide the tip
  }, true);
  document.addEventListener('focusin', e => { const t = e.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('click', () => { if (!pressShown) hideTip(); }, true); // a long-press tip outlives its own click
  window.addEventListener('scroll', hideTip, { passive: true });

  /* The close tab and the brand: back to the Home; in a match the confirmation comes first. */
  function closeBook() {
    if (app.busy) return;
    if (app.route.page === 'game') {
      if (app.chapter) { app.chapter = null; app.game.view = 'board'; } // the chapter gives way to the confirmation
      GAME.close();
      return;
    }
    if (app.route.page !== 'home' || app.chapter) navigate('#/');
  }
  function onNav(kind) {
    if (kind === 'user') { toast('The player page (/player) opens here — step 13'); return; }
    closeBook();
  }

  function init() {
    readControls();
    setNavHeight();
    window.addEventListener('resize', setNavHeight);
    ['fx-deal', 'fx-facedown', 'fx-play', 'fx-turn', 'fx-turn-mode', 'fx-speed', 'fx-latency', 'fx-deck', 'fx-vibrate', 'fx-reduced']
      .forEach(id => $('#' + id).addEventListener('input', () => {
        readControls();
        if (!app.busy) deal(); // a deal switched off shows the waiting cards at once
      }));
    $('#btn-redeal').addEventListener('click', redeal);
    $('#btn-restart').addEventListener('click', () => {
      app.game = null;
      app.config = {};
      app.ps = {};
      navigate('#/');
    });
    els.fab.addEventListener('click', () => {
      els.panel.hidden = !els.panel.hidden;
      els.fab.setAttribute('aria-expanded', String(!els.panel.hidden));
    });

    document.addEventListener('click', e => {
      const t = e.target.closest('[data-act],[data-act2],[data-info],[data-back],[data-bm],[data-nav],[data-policy],[data-left],[data-page-act],[data-note],[data-note-hide]');
      if (!t) return;
      if (t.dataset.nav) { e.preventDefault(); onNav(t.dataset.nav); return; }
      if (t.dataset.act !== undefined) { onAct(Number(t.dataset.act)); return; }
      if (t.dataset.info !== undefined) { onInfo(Number(t.dataset.info)); return; }
      if (t.dataset.back) { onBack(); return; }
      if (t.dataset.bm === 'home') { closeBook(); return; }
      if (t.dataset.bm) { if (!app.busy && controller().tab) controller().tab(t.dataset.bm); return; }
      if (t.dataset.policy) { openChapter(t.dataset.policy); return; }
      if (t.dataset.left) { if (!app.busy && controller().leftAct) controller().leftAct(t.dataset.left); return; }
      if (t.dataset.act2) { const [i, j] = t.dataset.act2.split(':').map(Number); onAct2(i, j); return; }
      if (t.dataset.pageAct) { const [side, j] = t.dataset.pageAct.split(':'); onPageAct(side, Number(j)); return; }
      if (t.dataset.note) { const [side, kind] = t.dataset.note.split(':'); toggleNote(side, kind); return; }
      if (t.dataset.noteHide) toggleNote(t.dataset.noteHide, null);
    });
    window.addEventListener('hashchange', () => {
      if (app.ignoreHash) { app.ignoreHash = false; return; }
      if (app.busy) app.pendingRoute = true; else openRoute();
    });

    openRoute(true);
  }

  init();
})();

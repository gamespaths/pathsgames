/* =============================================
   PATHS GAMES — main.js  (v0.16.3-prototype-api)
   Full prototype with API-driven story catalog,
   server selector (LOCAL / AWS / MOCK), game world,
   (i) info using link_copyright + id_text_copyright.
   ============================================= */
(function () {
  'use strict';

  /* ══════════════════════════════════════════
     SERVER CONFIGURATION
     ══════════════════════════════════════════ */
  const SERVERS = {
    'local': { label: 'LOCAL',  url: 'http://localhost:8042' },
    'aws':   { label: 'AWS',    url: 'https://<REMOTE_API>.execute-api.us-east-2.amazonaws.com/dev' },
    'mock':  { label: 'MOCK',   url: null }
  };
  const DEFAULT_LANG = 'en';

  /* ══════════════════════════════════════════
     APPLICATION STATE
     ══════════════════════════════════════════ */
  let currentServer   = 'local';
  let serverOnline    = null;       // null = unknown, true/false
  let usingMock       = true;
  let stories         = [];         // StorySummary[] from API or mock
  let healthCheckTimer = null;

  /* Game state (from v0.15.4) */
  let currentId   = null;
  let navHistory  = [];
  let activeStory = null;

  /* Preview modal state */
  let pendingStoryUuid = null;
  let storyDetail      = null;     // StoryDetail from API
  let cardDetail       = null;     // CardDetail from /api/content/
  let optionStep       = 0;
  let selectedOptions  = {};
  let termsAccepted    = false;

  /* Option images — Unsplash (from v0.15.4) */
  const STORY_OPTIONS = [
    {
      option: 'Difficulty',
      icon: 'fas fa-skull-crossbones',
      values: [
        { label: 'Easy', icon: 'fas fa-feather', disabled: false,
          image: 'https://images.unsplash.com/photo-1593007791459-4b05e1158229?w=200&fit=crop&q=80',
          credit: { artist: 'Nick Fewings', url: 'https://unsplash.com/photos/black-and-gray-i-love-you-print-textile-4pZu15OeTXA' } },
        { label: 'Medium', icon: 'fas fa-shield-alt', disabled: true,
          image: 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=200&fit=crop&q=80',
          credit: { artist: 'Slyvain Mauroux', url: 'https://unsplash.com/photos/mountain-peaks-during-golden-hour-B_S_6Br_M38' } },
        { label: 'Hard', icon: 'fas fa-skull-crossbones', disabled: true,
          image: 'https://images.unsplash.com/photo-1520114056694-98d72e3388d1?w=200&fit=crop&q=80',
          credit: { artist: 'Milos Prelevic', url: 'https://unsplash.com/photos/selective-focus-photography-of-skull-illustration-bt-on9VbdAI' } }
      ]
    },
    {
      option: 'Character',
      icon: 'fas fa-user',
      values: [
        { label: 'Hero', icon: 'fas fa-crown', disabled: false,
          image: 'https://images.unsplash.com/photo-1629812456605-4a044aa38fbc?w=200&fit=crop&q=80',
          credit: { artist: 'Ricardo Rocha', url: 'https://unsplash.com/photos/man-in-knight-armor-s65vH-5V_9g' } },
        { label: 'Evil', icon: 'fas fa-skull', disabled: true,
          image: 'https://images.unsplash.com/photo-1582738412120-7f97558301ec?w=200&fit=crop&q=80',
          credit: { artist: 'Henry Be', url: 'https://unsplash.com/photos/man-walking-on-foggy-road-I1SAnvRJ-Sg' } },
        { label: 'Poor', icon: 'fas fa-hat-wizard', disabled: true,
          image: 'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=200&fit=crop&q=80',
          credit: { artist: 'Lucas Sankey', url: 'https://unsplash.com/photos/man-standing-on-grass-field-w_q9oP_1z34' } }
      ]
    },
    {
      option: 'Type',
      icon: 'fas fa-gamepad',
      values: [
        { label: 'Single Player', icon: 'fas fa-user', disabled: false,
          image: 'https://images.unsplash.com/photo-1524334228333-0f6db392f8a1?w=200&fit=crop&q=80',
          credit: { artist: 'Ginevra Casa', url: 'https://unsplash.com/photos/woman-standing-on-mountain-peak-H9f6p3mPhXQ' } },
        { label: 'Multiplayer', icon: 'fas fa-users', disabled: true,
          image: 'https://images.unsplash.com/photo-1502444330042-d1a1ddf9ca5c?w=200&fit=crop&q=80',
          credit: { artist: 'Vinit Vispute', url: 'https://unsplash.com/photos/people-sitting-on-ground-near-mountain-during-daytime-O6VvT8f8kXs' } },
        { label: 'Open World', icon: 'fas fa-globe', disabled: true,
          image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200&fit=crop&q=80',
          credit: { artist: 'NASA', url: 'https://unsplash.com/photos/photo-of-outer-space-yZygONrUBe8' } }
      ]
    }
  ];

  /* Login card images */
  const LOGIN_IMAGES = {
    guest:    { image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200&fit=crop&q=80',
                credit: { artist: 'Kal Visual', url: 'https://unsplash.com/photos/asphalt-road-between-green-trees-under-white-clouds-during-daytime-78A265wPiO4' } },
    register: { image: 'https://images.unsplash.com/photo-1512418490979-92798ccc1380?w=200&fit=crop&q=80',
                credit: { artist: 'Aaron Burden', url: 'https://unsplash.com/photos/white-feather-on-black-surface-y02jbuPbF_E' } },
    login:    { image: 'https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=200&fit=crop&q=80',
                credit: { artist: 'Jonas Stolle', url: 'https://unsplash.com/photos/low-angle-view-of-spiral-staircase-7_V0M2p5ZpE' } }
  };

  /* Final option images */
  const FINAL_IMAGES = {
    terms: { image: 'https://images.unsplash.com/photo-1512418490979-92798ccc1380?w=200&fit=crop&q=80',
             credit: { artist: 'Aaron Burden', url: 'https://unsplash.com/photos/white-feather-on-black-surface-y02jbuPbF_E' } },
    start: { image: 'https://images.unsplash.com/photo-1510942201312-84e7962f6dbb?w=200&fit=crop&q=80',
             credit: { artist: 'Fabio Comparelli', url: 'https://unsplash.com/photos/brown-cave-under-blue-sky-during-daytime-p_S_d_6P_Uo' } }
  };

  /* ══════════════════════════════════════════
     DOM HELPERS
     ══════════════════════════════════════════ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function baseUrl() {
    return SERVERS[currentServer]?.url || null;
  }

  /* DOM refs */
  const elCatalog   = $('#story-catalog');
  const elWorld     = $('#world');
  const elGameBar   = $('#game-bar');
  const elBarTitle  = $('#game-bar-title');
  const btnMap      = $('#btn-map');
  const btnJournal  = $('#btn-journal');
  const elHero      = $('#hero-banner');

  /* ══════════════════════════════════════════
     SERVER STATUS & HEALTH CHECK
     ══════════════════════════════════════════ */
  function setStatus(online) {
    serverOnline = online;
    const dot   = $('#server-status-dot');
    const label = $('#server-status-label');
    const badge = $('#data-source-badge');

    if (dot) {
      dot.className = 'server-status-dot ' + (online === null ? 'loading' : online ? 'online' : 'offline');
    }
    if (label) {
      label.textContent = online === null ? 'checking…' : online ? 'online' : 'offline';
    }
    if (badge) {
      badge.className = 'data-source-badge ' + (usingMock ? 'mock' : 'api');
      badge.textContent = usingMock ? 'MOCK' : 'API';
    }
  }

  async function healthCheck() {
    const url = baseUrl();
    if (!url) { setStatus(false); return false; }
    setStatus(null);
    try {
      const resp = await fetch(url + '/api/stories?lang=' + DEFAULT_LANG, {
        signal: AbortSignal.timeout(4000)
      });
      if (resp.ok) { setStatus(true); return true; }
      setStatus(false); return false;
    } catch {
      setStatus(false); return false;
    }
  }

  function startHealthPoll() {
    if (healthCheckTimer) clearInterval(healthCheckTimer);
    healthCheckTimer = setInterval(async () => {
      if (!usingMock || currentServer === 'mock') return;
      const ok = await healthCheck();
      if (ok && usingMock) {
        usingMock = false;
        setStatus(true);
        await loadStories();
      }
    }, 15000);
  }

  /* ══════════════════════════════════════════
     API CALLS
     ══════════════════════════════════════════ */
  async function apiGet(path) {
    const url = baseUrl();
    if (!url) throw new Error('No server URL');
    const resp = await fetch(url + path, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }

  async function fetchStories() {
    return apiGet('/api/stories?lang=' + DEFAULT_LANG);
  }

  async function fetchStoryDetail(uuid) {
    return apiGet('/api/stories/' + encodeURIComponent(uuid) + '?lang=' + DEFAULT_LANG);
  }

  async function fetchCardDetail(storyUuid, cardUuid) {
    return apiGet('/api/content/' + encodeURIComponent(storyUuid) + '/cards/' + encodeURIComponent(cardUuid) + '?lang=' + DEFAULT_LANG);
  }

  /* ══════════════════════════════════════════
     LOAD STORIES (API → fallback mock)
     ══════════════════════════════════════════ */
  async function loadStories() {
    elCatalog.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> Loading stories…</div>';

    if (currentServer === 'mock') {
      stories = typeof MOCK_STORIES !== 'undefined' ? MOCK_STORIES : [];
      usingMock = true;
      setStatus(false);
    } else {
      try {
        stories = await fetchStories();
        usingMock = false;
        setStatus(true);
      } catch {
        stories = typeof MOCK_STORIES !== 'undefined' ? MOCK_STORIES : [];
        usingMock = true;
        setStatus(false);
      }
    }

    renderCatalog();
    startHealthPoll();
  }

  /* ══════════════════════════════════════════
     HERO IMAGE SETUP
     ══════════════════════════════════════════ */
  function initHero() {
    const heroImg = $('#hero-img');
    const heroInfoBtn = $('#hero-info-btn');
    if (heroImg && typeof HERO_IMAGE !== 'undefined') {
      heroImg.src = HERO_IMAGE.url;
      heroImg.alt = 'Medieval Castle — Photo by ' + HERO_IMAGE.artist;
    }
    if (heroInfoBtn && typeof HERO_IMAGE !== 'undefined') {
      heroInfoBtn.setAttribute('data-credit-artist', HERO_IMAGE.artist);
      heroInfoBtn.setAttribute('data-credit-url', HERO_IMAGE.profileUrl);
    }
  }

  /* ══════════════════════════════════════════
     MAGIC CODE GENERATOR
     ══════════════════════════════════════════ */
  const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛇᛈᛋᛏᛒᛖᛚᛞᛟᛠᛡᛣ';
  const HEX   = '0123456789abcdef';
  const GLYPHS= '†‡§¶♠♣♥♦★✶✷✻❁❖◆◊•×÷≈∞∴∵≡';
  function magicCode(len) {
    const pools = [RUNES, HEX, GLYPHS];
    const pool  = pools[Math.floor(Math.random() * pools.length)];
    let out = '';
    for (let i = 0; i < len; i++) {
      if (i > 0 && i % 4 === 0) out += ' ';
      out += pool[Math.floor(Math.random() * pool.length)];
    }
    return out;
  }

  function getCategoryIcon(cat) {
    const map = {
      tutorial:  'fas fa-graduation-cap',
      fantasy:   'fas fa-chess-rook',
      adventure: 'fas fa-compass',
      pirate:    'fas fa-anchor',
      horror:    'fas fa-skull',
      mystery:   'fas fa-search',
      dark:      'fas fa-moon'
    };
    return map[(cat || '').toLowerCase()] || 'fas fa-book';
  }

  /* ══════════════════════════════════════════
     RENDER CATALOG — Netflix-style rows
     Cards show: card.imageUrl OR card.awesomeIcon,
     title, description. (i) on card cover corner.
     ══════════════════════════════════════════ */
  function renderCatalog() {
    if (!stories.length) {
      elCatalog.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> No stories available.</div>';
      return;
    }

    /* Group by category */
    const cats = {};
    stories.forEach(s => {
      const cat = (s.category || 'other').charAt(0).toUpperCase() + (s.category || 'other').slice(1);
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(s);
    });

    let html = '';
    for (const [cat, list] of Object.entries(cats)) {
      html += '<div class="catalog-category">';
      html += '<h3 class="catalog-cat-title">' + esc(cat) + '</h3>';
      html += '<div class="catalog-row">';
      list.forEach(s => { html += renderStoryCard(s); });
      html += '</div></div>';
    }

    elCatalog.innerHTML = html;

    /* Bind play buttons */
    elCatalog.querySelectorAll('.catalog-play-btn:not(.catalog-play-btn-disabled)').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        showStoryPreview(btn.dataset.storyUuid);
      });
    });

    /* Horizontal drag-scroll */
    elCatalog.querySelectorAll('.catalog-row').forEach(initDragScroll);
  }

  function renderStoryCard(s) {
    const card = s.card || {};
    const hasImage = !!card.imageUrl;
    const icon = card.awesomeIcon || getCategoryIcon(s.category);

    /* Cover: card image or FA icon */
    let coverHTML;
    if (hasImage) {
      coverHTML = '<img src="' + esc(card.imageUrl) + '" alt="' + esc(s.title) + '" class="catalog-card-img"/>';
    } else {
      coverHTML = '<i class="' + esc(icon) + ' catalog-card-icon"></i>';
    }

    /* (i) button on the card cover, right-bottom corner */
    const infoBtn = '<button class="card-info-btn catalog-cover-info-btn" title="Info"' +
      ' data-story-uuid="' + esc(s.uuid) + '">' +
      '<i class="fas fa-info-circle"></i></button>';

    /* Playable if we have game-world data */
    const playable = typeof STORIES_LOCATIONS !== 'undefined' && STORIES_LOCATIONS[s.uuid];
    const btnClass  = playable ? 'catalog-play-btn' : 'catalog-play-btn catalog-play-btn-disabled';
    const btnLabel  = playable ? '<i class="fas fa-play me-1"></i>Play' : '<i class="fas fa-eye me-1"></i>Details';
    const btnAttrs  = 'data-story-uuid="' + esc(s.uuid) + '"';

    return '<div class="catalog-card card-dimension-normal card-3d" data-story-uuid="' + esc(s.uuid) + '">' +
      '<div class="catalog-card-cover">' + coverHTML + infoBtn + '</div>' +
      '<div class="catalog-title-plate card-decorative"><span>' + esc(s.title) + '</span></div>' +
      '<button class="' + btnClass + '" ' + btnAttrs + '>' + btnLabel + '</button>' +
      '</div>';
  }

  /* ══════════════════════════════════════════
     STORY PREVIEW MODAL — show details from API
     On LOCAL server: fetch /api/stories/{uuid}
     for difficulties, classes, traits, card info.
     ══════════════════════════════════════════ */
  async function showStoryPreview(uuid) {
    const story = stories.find(s => s.uuid === uuid);
    if (!story) return;
    pendingStoryUuid = uuid;
    optionStep = 0;
    selectedOptions = {};
    termsAccepted = false;
    storyDetail = null;
    cardDetail = null;

    $('#preview-modal-title').textContent = story.title;

    const body = $('#story-preview-body');
    const card = story.card || {};

    /* Cover visual — use card image or icon */
    let coverHTML;
    if (card.imageUrl) {
      coverHTML = '<img src="' + esc(card.imageUrl) + '" alt="' + esc(story.title) + '" class="preview-visual-img" style="width:100%;height:100%;object-fit:cover;" />';
    } else if (card.awesomeIcon) {
      coverHTML = '<i class="' + esc(card.awesomeIcon) + '" style="font-size:6rem;color:var(--color-gold-light);"></i>';
    } else {
      coverHTML = '<i class="' + getCategoryIcon(story.category) + '" style="font-size:6rem;color:var(--color-gold-light);"></i>';
    }

    body.innerHTML =
      '<div class="story-preview-main card-dimension-large card-3d">' +
        '<div class="preview-visual">' + coverHTML + '</div>' +
        '<div class="preview-title-plate card-decorative"><span>' + esc(story.title) + '</span></div>' +
        '<div class="preview-info-footer">' +
          '<button class="card-info-btn" title="Info" data-story-uuid="' + esc(uuid) + '"><i class="fas fa-info-circle"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="story-preview-options" id="story-preview-options">' +
        '<div class="loading-spinner"><i class="fas fa-spinner"></i> Loading details…</div>' +
      '</div>';

    new bootstrap.Modal($('#storyPreviewModal')).show();

    /* Fetch story detail for difficulties/characters (if LOCAL/AWS server online) */
    if (!usingMock && currentServer !== 'mock') {
      try {
        storyDetail = await fetchStoryDetail(uuid);
      } catch {
        storyDetail = getMockDetail(uuid);
      }
    } else {
      storyDetail = getMockDetail(uuid);
    }

    /* Fetch card detail for copyright info */
    if (storyDetail && storyDetail.card && storyDetail.card.uuid) {
      if (!usingMock && currentServer !== 'mock') {
        try {
          cardDetail = await fetchCardDetail(uuid, storyDetail.card.uuid);
        } catch {
          cardDetail = getMockCardDetail(storyDetail.card.uuid);
        }
      } else {
        cardDetail = getMockCardDetail(storyDetail.card.uuid);
      }
    }

    /* Now render options — use API difficulties if available */
    renderOptionsStep();
    add3dEffect();
  }

  function getMockDetail(uuid) {
    return (typeof MOCK_STORY_DETAILS !== 'undefined') ? MOCK_STORY_DETAILS[uuid] : null;
  }

  function getMockCardDetail(cardUuid) {
    return (typeof MOCK_CARD_DETAILS !== 'undefined') ? MOCK_CARD_DETAILS[cardUuid] : null;
  }

  /* ══════════════════════════════════════════
     OPTIONS STEP — if API detail has difficulties,
     use those; otherwise fall back to static options.
     ══════════════════════════════════════════ */
  function renderOptionsStep() {
    const container = $('#story-preview-options');
    if (!container) return;

    /* Step 0: Difficulty — use API difficulties if available */
    if (optionStep === 0 && storyDetail && storyDetail.difficulties && storyDetail.difficulties.length) {
      renderApiDifficulties(container);
      return;
    }

    /* Step 1: Character — use API classes if available and option step > difficulties */
    if (optionStep === 1 && storyDetail && storyDetail.classes && storyDetail.classes.length) {
      renderApiClasses(container);
      return;
    }

    /* Fallback to static STORY_OPTIONS (from v0.15.4) */
    if (optionStep < STORY_OPTIONS.length) {
      const group = STORY_OPTIONS[optionStep];
      let html = '<h4 class="options-step-title"><i class="' + group.icon + ' me-2"></i>' + group.option + '</h4>';
      html += '<div class="options-cards-row">';

      group.values.forEach(val => {
        const disabledClass = val.disabled ? 'option-disabled' : '';
        const btnDisabled   = val.disabled ? 'disabled' : '';
        const btnLabel      = val.disabled ? '<i class="fas fa-lock me-1"></i>Locked' : '<i class="fas fa-check me-1"></i>Select';
        const imgHTML       = val.image
          ? '<img src="' + val.image + '" alt="' + val.label + '" />'
          : '<i class="' + val.icon + '"></i>';
        const creditArtist  = val.credit ? val.credit.artist : 'paths.games';
        const creditUrl     = val.credit ? val.credit.url : 'https://paths.games';

        html += '<div class="option-card card-dimension-little ' + disabledClass + ' card-3d"' +
          ' data-value="' + val.label + '"' +
          ' data-credit-artist="' + creditArtist + '"' +
          ' data-credit-url="' + creditUrl + '">' +
          '<div class="option-visual">' + imgHTML + '</div>' +
          '<div class="option-title-plate card-decorative"><span>' + val.label + '</span></div>' +
          '<button class="option-select-btn" ' + btnDisabled + '>' + btnLabel + '</button>' +
          '</div>';
      });
      html += '</div>';
      html += renderSummaryBadges();

      container.innerHTML = html;

      container.querySelectorAll('.option-card:not(.option-disabled) .option-select-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const card = btn.closest('.option-card');
          selectedOptions[group.option] = card.dataset.value;
          optionStep++;
          renderOptionsStep();
        });
      });
    } else {
      renderLoginStep();
    }
    add3dEffect();
  }

  /* ── API-driven difficulty cards ── */
  function renderApiDifficulties(container) {
    const diffs = storyDetail.difficulties;
    let html = '<h4 class="options-step-title"><i class="fas fa-dumbbell me-2"></i>Difficulty</h4>';
    html += '<div class="options-cards-row">';

    diffs.forEach((d, i) => {
      const disabled = i > 0;  // only first enabled like v0.15.4
      const disabledClass = disabled ? 'option-disabled' : '';
      const btnDisabled   = disabled ? 'disabled' : '';
      const btnLabel      = disabled ? '<i class="fas fa-lock me-1"></i>Locked' : '<i class="fas fa-check me-1"></i>Select';
      html += '<div class="option-card card-dimension-little ' + disabledClass + ' card-3d" data-value="' + esc(d.name) + '">' +
        '<div class="option-visual"><i class="fas fa-dumbbell" style="font-size:3rem;color:var(--color-gold-light);"></i></div>' +
        '<div class="option-title-plate card-decorative"><span>' + esc(d.name) + '</span></div>' +
        '<button class="option-select-btn" ' + btnDisabled + '>' + btnLabel + '</button>' +
        '</div>';
    });
    html += '</div>';
    html += renderSummaryBadges();
    container.innerHTML = html;

    container.querySelectorAll('.option-card:not(.option-disabled) .option-select-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const card = btn.closest('.option-card');
        selectedOptions['Difficulty'] = card.dataset.value;
        optionStep++;
        renderOptionsStep();
      });
    });
    add3dEffect();
  }

  /* ── API-driven class/character cards ── */
  function renderApiClasses(container) {
    const classes = storyDetail.classes;
    let html = '<h4 class="options-step-title"><i class="fas fa-users me-2"></i>Character Class</h4>';
    html += '<div class="options-cards-row">';

    classes.forEach((cl, i) => {
      const disabled = i > 0;  // only first enabled
      const disabledClass = disabled ? 'option-disabled' : '';
      const btnDisabled   = disabled ? 'disabled' : '';
      const btnLabel      = disabled ? '<i class="fas fa-lock me-1"></i>Locked' : '<i class="fas fa-check me-1"></i>Select';
      html += '<div class="option-card card-dimension-little ' + disabledClass + ' card-3d" data-value="' + esc(cl.name) + '">' +
        '<div class="option-visual"><i class="fas fa-shield-alt" style="font-size:3rem;color:var(--color-gold-light);"></i></div>' +
        '<div class="option-title-plate card-decorative"><span>' + esc(cl.name) + '</span></div>' +
        '<button class="option-select-btn" ' + btnDisabled + '>' + btnLabel + '</button>' +
        '</div>';
    });
    html += '</div>';
    html += renderSummaryBadges();
    container.innerHTML = html;

    container.querySelectorAll('.option-card:not(.option-disabled) .option-select-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const card = btn.closest('.option-card');
        selectedOptions['Character'] = card.dataset.value;
        optionStep++;
        renderOptionsStep();
      });
    });
    add3dEffect();
  }

  function renderSummaryBadges() {
    if (Object.keys(selectedOptions).length === 0) return '';
    let html = '<div class="options-summary">';
    for (const [key, value] of Object.entries(selectedOptions)) {
      html += '<span class="option-summary-badge"><i class="fas fa-check-circle me-1"></i>' + key + ': ' + value + '</span>';
    }
    html += '</div>';
    return html;
  }

  /* ══════════════════════════════════════════
     LOGIN STEP — image-first cards (from v0.15.4)
     ══════════════════════════════════════════ */
  function renderLoginStep() {
    const container = $('#story-preview-options');
    if (!container) return;

    let html = '<h4 class="options-step-title"><i class="fas fa-user-circle me-2"></i>Login</h4>';
    html += '<div class="options-cards-row">';

    const g = LOGIN_IMAGES.guest;
    html += '<div class="option-card card-dimension-little card-3d" data-value="guest"' +
      ' data-credit-artist="' + g.credit.artist + '" data-credit-url="' + g.credit.url + '">' +
      '<div class="option-visual"><img src="' + g.image + '" alt="Guest" /></div>' +
      '<div class="option-title-plate card-decorative"><span>Guest</span></div>' +
      '<button class="option-select-btn" id="btn-login-guest"><i class="fas fa-play me-1"></i>Guest</button></div>';

    const r = LOGIN_IMAGES.register;
    html += '<div class="option-card card-dimension-little option-disabled card-3d" data-value="register"' +
      ' data-credit-artist="' + r.credit.artist + '" data-credit-url="' + r.credit.url + '">' +
      '<div class="option-visual"><img src="' + r.image + '" alt="Register" /></div>' +
      '<div class="option-title-plate card-decorative"><span>Register</span></div>' +
      '<button class="option-select-btn" disabled><i class="fas fa-lock me-1"></i>Register</button></div>';

    const l = LOGIN_IMAGES.login;
    html += '<div class="option-card card-dimension-little option-disabled card-3d" data-value="login"' +
      ' data-credit-artist="' + l.credit.artist + '" data-credit-url="' + l.credit.url + '">' +
      '<div class="option-visual"><img src="' + l.image + '" alt="Login" /></div>' +
      '<div class="option-title-plate card-decorative"><span>Login</span></div>' +
      '<button class="option-select-btn" disabled><i class="fas fa-lock me-1"></i>Login</button></div>';

    html += '</div>';
    html += renderSummaryBadges();

    container.innerHTML = html;

    container.querySelector('#btn-login-guest')?.addEventListener('click', e => {
      e.stopPropagation();
      selectedOptions['Login'] = 'Guest';
      renderFinalOptions();
    });
    add3dEffect();
  }

  /* ══════════════════════════════════════════
     FINAL OPTIONS — terms + start
     ══════════════════════════════════════════ */
  function renderFinalOptions() {
    const container = $('#story-preview-options');
    if (!container) return;

    const summaryHTML = renderSummaryBadges();

    const checkVisual = termsAccepted
      ? '<i class="fas fa-check-square" style="font-size:3rem;color:var(--color-gold-light);"></i>'
      : '<span class="option-terms-notice">To play you must read and accept ' +
        '<button class="option-terms-info" id="btn-terms-info" title="Read Terms">the terms of conditions</button></span>';
    const startDisabled     = termsAccepted ? '' : 'disabled';
    const startOpacity      = termsAccepted ? '' : 'option-btn-disabled';
    const startCardOpacity  = termsAccepted ? '' : 'option-disabled';
    const termsCardOpacity  = termsAccepted ? 'option-disabled' : '';

    const t = FINAL_IMAGES.terms;
    const s = FINAL_IMAGES.start;

    let html = '<h4 class="options-step-title"><i class="fas fa-play me-2"></i>Ready to Play</h4>';
    html += '<div class="options-cards-row">';

    html += '<div class="option-card card-dimension-little final-card ' + termsCardOpacity + ' card-3d"' +
      ' data-credit-artist="' + t.credit.artist + '" data-credit-url="' + t.credit.url + '">' +
      '<div class="option-visual">' + (termsAccepted ? checkVisual : '<img src="' + t.image + '" alt="Terms" />') + '</div>' +
      '<div class="option-title-plate card-decorative"><span>Terms</span></div>' +
      '<button class="option-select-btn" id="btn-accept-terms"><i class="fas fa-check me-1"></i>' + (termsAccepted ? 'Accepted' : 'Accept') + '</button></div>';

    html += '<div class="option-card card-dimension-little final-card ' + startCardOpacity + ' card-3d"' +
      ' data-credit-artist="' + s.credit.artist + '" data-credit-url="' + s.credit.url + '">' +
      '<div class="option-visual"><img src="' + s.image + '" alt="Start Adventure" /></div>' +
      '<div class="option-title-plate card-decorative"><span>Start</span></div>' +
      '<button class="option-select-btn ' + startOpacity + '" id="btn-start-adventure" ' + startDisabled + '><i class="fas fa-play me-1"></i>Start</button></div>';

    html += '</div>';
    html += summaryHTML;

    /* Show API story meta badges if available */
    if (storyDetail) {
      html += '<div class="story-meta-badges" style="margin-top:1rem;">';
      if (storyDetail.author) html += '<span class="story-meta-badge"><i class="fas fa-user-edit"></i>' + esc(storyDetail.author) + '</span>';
      if (storyDetail.locationCount) html += '<span class="story-meta-badge"><i class="fas fa-map-marker-alt"></i>' + storyDetail.locationCount + ' Locations</span>';
      if (storyDetail.eventCount) html += '<span class="story-meta-badge"><i class="fas fa-bolt"></i>' + storyDetail.eventCount + ' Events</span>';
      if (storyDetail.peghi) html += '<span class="story-meta-badge"><i class="fas fa-gem" style="color:var(--color-gold)"></i>' + storyDetail.peghi + '</span>';
      html += '</div>';
    }

    container.innerHTML = html;

    container.querySelector('#btn-terms-info')?.addEventListener('click', e => {
      e.stopPropagation();
      new bootstrap.Modal($('#termsModal')).show();
    });
    container.querySelector('#btn-accept-terms')?.addEventListener('click', e => {
      e.stopPropagation();
      termsAccepted = !termsAccepted;
      renderFinalOptions();
    });
    container.querySelector('#btn-start-adventure')?.addEventListener('click', e => {
      e.stopPropagation();
      if (!termsAccepted || !pendingStoryUuid) return;
      const modal = bootstrap.Modal.getInstance($('#storyPreviewModal'));
      if (modal) modal.hide();
      startStory(pendingStoryUuid);
      pendingStoryUuid = null;
    });
    add3dEffect();
  }

  /* Modal Play button (fallback) */
  $('#btn-preview-play')?.addEventListener('click', () => {
    if (!pendingStoryUuid) return;
    const modal = bootstrap.Modal.getInstance($('#storyPreviewModal'));
    if (modal) modal.hide();
    startStory(pendingStoryUuid);
    pendingStoryUuid = null;
  });

  /* ══════════════════════════════════════════
     START / STOP STORY
     ══════════════════════════════════════════ */
  function startStory(storyUuid) {
    /* Check if we have game-world data for this story */
    if (typeof STORIES_LOCATIONS === 'undefined' || !STORIES_LOCATIONS[storyUuid]) {
      showPopup('✦ This story is not yet playable — coming soon! ✦');
      return;
    }
    const locMap = STORIES_LOCATIONS[storyUuid];
    const startLoc = Object.keys(locMap)[0]; // first location
    if (!startLoc) return;

    activeStory = { uuid: storyUuid, title: stories.find(s => s.uuid === storyUuid)?.title || 'Adventure' };
    currentId   = startLoc;
    navHistory  = [];

    elCatalog.style.display  = 'none';
    elWorld.style.display    = '';
    elGameBar.style.display  = '';
    elHero.style.display     = 'none';
    elBarTitle.textContent   = activeStory.title;

    renderLocation(currentId);
    add3dEffect();
  }

  function stopStory() {
    activeStory = null;
    currentId   = null;
    navHistory  = [];

    Array.from(elWorld.children).forEach(c => { if (c.id !== 'player-bar') c.remove(); });
    elWorld.style.display   = 'none';
    elHero.style.display    = '';
    elGameBar.style.display = 'none';
    elCatalog.style.display = '';
  }

  /* ══════════════════════════════════════════
     RENDER — single location (image-first cards)
     ══════════════════════════════════════════ */
  function renderLocation(id, direction) {
    if (!activeStory) return;
    const locMap = (typeof STORIES_LOCATIONS !== 'undefined') ? STORIES_LOCATIONS[activeStory.uuid] || {} : {};
    const loc    = locMap[id];
    if (!loc) return;
    currentId = id;

    const creditAttr = (c) => c ? ' data-credit-artist="' + c.artist + '" data-credit-url="' + c.url + '"' : '';

    /* Location card */
    const visualHTML = loc.image
      ? '<img src="' + loc.image + '" alt="' + loc.title + '" class="card-visual-img" />'
      : '<span class="card-visual-emote">' + loc.emote + '</span>';

    const locationCardHTML =
      '<div class="location-card card-dimension-large card-3d"' + creditAttr(loc.imageCredit) + '>' +
        '<div class="card-visual">' + visualHTML + '</div>' +
        '<div class="card-title-plate card-decorative">' +
          '<span>' + loc.title + '</span>' +
          '<i class="' + loc.icon + ' card-plate-icon"' + (loc.iconColor ? ' style="color:' + loc.iconColor + '"' : '') + '></i>' +
        '</div>' +
        '<div class="card-desc-area">' +
          '<p>' + loc.desc + '</p>' +
          '<button class="card-info-btn" title="Photo credit"><i class="fas fa-info-circle"></i></button>' +
        '</div>' +
      '</div>';

    /* Neighbor (go) cards */
    const goCardsHTML = (loc.neighbors || []).map(nid => {
      const n = locMap[nid];
      if (!n) return '';
      const nVisual = n.image
        ? '<img src="' + n.image + '" alt="' + n.title + '" class="choice-visual-img" />'
        : '<span class="choice-visual-emote">' + n.emote + '</span>';
      return '<div class="choice-card card-dimension-normal go-card card-3d" data-target="' + n.id + '"' + creditAttr(n.imageCredit) + '>' +
        '<div class="choice-visual">' + nVisual + '</div>' +
        '<div class="choice-title-plate card-decorative">' +
          '<span>' + n.title + '</span>' +
          '<i class="' + n.icon + ' choice-plate-icon"' + (n.iconColor ? ' style="color:' + n.iconColor + '"' : '') + '></i>' +
        '</div>' +
        '<div class="choice-info-footer">' +
          '<button class="card-info-btn" title="Photo credit"><i class="fas fa-info-circle"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');

    /* Action cards */
    const actionCardsHTML = (loc.actions || []).map(a => {
      const aVisual = a.image
        ? '<img src="' + a.image + '" alt="' + a.title + '" class="choice-visual-img" />'
        : '<span class="choice-visual-emote">' + a.emote + '</span>';
      return '<div class="choice-card card-dimension-normal action-card card-3d" data-action="' + a.id + '"' + creditAttr(a.imageCredit) + '>' +
        '<div class="choice-visual">' + aVisual + '</div>' +
        '<div class="choice-title-plate card-decorative">' +
          '<span>' + a.title + '</span>' +
          '<i class="' + a.icon + ' choice-plate-icon"></i>' +
        '</div>' +
        '<div class="choice-info-footer">' +
          '<button class="card-info-btn" title="Photo credit"><i class="fas fa-info-circle"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');

    /* Build scene */
    const scene = document.createElement('div');
    scene.className = 'game-scene';
    scene.innerHTML =
      '<div class="game-location-panel">' + locationCardHTML + '</div>' +
      '<div class="game-right-panel">' +
        '<div class="game-row">' +
          '<h3 class="game-row-title"><i class="fas fa-compass me-2"></i>Nearby Locations</h3>' +
          '<div class="game-row-scroll go-cards-scroll">' + (goCardsHTML || '<span class="game-row-empty">No paths lead further.</span>') + '</div>' +
        '</div>' +
        '<div class="game-row">' +
          '<h3 class="game-row-title"><i class="fas fa-scroll me-2"></i>Available Actions</h3>' +
          '<div class="game-row-scroll action-cards-scroll">' + (actionCardsHTML || '<span class="game-row-empty">Nothing to do here.</span>') + '</div>' +
        '</div>' +
      '</div>';

    const container = elWorld;
    if (container.children.length > 0 && direction) {
      const old = container.children[0];
      const outClass = direction === 'back' ? 'slide-out-right' : 'slide-out-left';
      const inClass  = direction === 'back' ? 'slide-in-left'   : 'slide-in-right';
      scene.classList.add(inClass);
      old.classList.add(outClass);
      old.addEventListener('animationend', () => {
        const elPlayerBar = document.getElementById('player-bar');
        Array.from(container.children).forEach(c => { if (c.id !== 'player-bar') c.remove(); });
        if (elPlayerBar) container.insertBefore(scene, elPlayerBar);
        else container.appendChild(scene);
        requestAnimationFrame(() => scene.classList.remove(inClass));
        bindGameEvents();
      }, { once: true });
    } else {
      const elPlayerBar = document.getElementById('player-bar');
      Array.from(container.children).forEach(c => { if (c.id !== 'player-bar') c.remove(); });
      if (elPlayerBar) container.insertBefore(scene, elPlayerBar);
      else container.appendChild(scene);
      bindGameEvents();
    }
    add3dEffect();
  }

  /* ══════════════════════════════════════════
     NAVIGATION
     ══════════════════════════════════════════ */
  function navigateTo(targetId) {
    navHistory.push(currentId);
    currentId = targetId;
    renderLocation(targetId, 'forward');
  }
  function navigateBack() {
    if (!navHistory.length) return;
    currentId = navHistory.pop();
    renderLocation(currentId, 'back');
  }

  /* ══════════════════════════════════════════
     BIND GAME EVENTS
     ══════════════════════════════════════════ */
  function bindGameEvents() {
    document.querySelectorAll('.go-card[data-target]').forEach(card => {
      card.addEventListener('click', () => {
        const locMap = (typeof STORIES_LOCATIONS !== 'undefined') ? STORIES_LOCATIONS[activeStory?.uuid] || {} : {};
        const n = locMap[card.dataset.target];
        if (!n) return;
        showCardModal(n, 'go', card.dataset.target);
      });
    });

    document.querySelectorAll('.action-card[data-action]').forEach(card => {
      card.addEventListener('click', () => {
        const locMap = (typeof STORIES_LOCATIONS !== 'undefined') ? STORIES_LOCATIONS[activeStory?.uuid] || {} : {};
        const loc    = locMap[currentId];
        const action = (loc?.actions || []).find(a => a.id === card.dataset.action);
        if (!action) return;
        showCardModal(action, 'action', card.dataset.action);
      });
    });

    document.querySelectorAll('.game-row-scroll').forEach(initDragScroll);
    initEntrance();
  }

  /* ══════════════════════════════════════════
     CARD DETAIL MODAL — image-first, 3D
     ══════════════════════════════════════════ */
  function showCardModal(data, type, id) {
    const isGo = type === 'go';
    const visual = data.image
      ? '<img src="' + data.image + '" alt="' + data.title + '" />'
      : '<span class="card-detail-emote">' + data.emote + '</span>';
    const confirmLabel = isGo
      ? '<i class="fas fa-shoe-prints me-2"></i>Move'
      : '<i class="fas fa-scroll me-2"></i>Proceed';
    const iconAttr = data.icon
      ? '<i class="' + data.icon + ' card-plate-icon"' + (data.iconColor ? ' style="color:' + data.iconColor + '"' : '') + '></i>'
      : '';
    const creditArtist = data.imageCredit ? data.imageCredit.artist : 'paths.games';
    const creditUrl    = data.imageCredit ? data.imageCredit.url : 'https://paths.games';

    document.getElementById('card-detail-inner').innerHTML =
      '<div class="card-detail-wrapper">' +
        '<button class="card-detail-close" data-bs-dismiss="modal" aria-label="Close"><i class="fas fa-times"></i></button>' +
        '<div class="card-detail-card card-dimension-large card-3d"' +
          ' data-credit-artist="' + creditArtist + '"' +
          ' data-credit-url="' + creditUrl + '">' +
          '<div class="card-detail-visual">' + visual + '</div>' +
          '<div class="card-title-plate card-decorative">' +
            '<span>' + data.title + '</span>' + iconAttr +
          '</div>' +
          '<p class="card-detail-desc">' + data.desc + '</p>' +
          '<div class="card-detail-footer">' +
            '<button class="story-preview-play-btn" id="btn-card-confirm">' + confirmLabel + '</button>' +
            '<button class="card-info-btn" title="Photo credit"><i class="fas fa-info-circle"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('btn-card-confirm').addEventListener('click', () => {
      bootstrap.Modal.getInstance(document.getElementById('cardDetailModal'))?.hide();
      if (isGo) navigateTo(id);
      else showPopup('✦ ' + data.title + ': coming soon… ✦');
    });

    new bootstrap.Modal(document.getElementById('cardDetailModal')).show();
    setTimeout(() => add3dEffect(), 100);
  }

  /* ══════════════════════════════════════════
     GAME BAR EVENTS
     ══════════════════════════════════════════ */
  btnMap?.addEventListener('click', () => showPopup('✦ The map is not yet available… ✦'));
  btnJournal?.addEventListener('click', () => showPopup('✦ The journal is not yet available… ✦'));
  document.getElementById('btn-inventory')?.addEventListener('click', () => showPopup('✦ The inventory is not yet available… ✦'));

  /* ══════════════════════════════════════════
     (i) INFO BUTTON — show copyright / credit modal
     Uses link_copyright and id_text_copyright from API.
     Falls back to Unsplash credit for game-world cards.
     ══════════════════════════════════════════ */
  document.addEventListener('click', e => {
    const btn = e.target.closest('.card-info-btn');
    if (!btn) return;
    e.stopPropagation();

    /* Check if this is a catalog card (i) with data-story-uuid */
    const storyUuid = btn.dataset.storyUuid;
    if (storyUuid) {
      showStoryCopyrightInfo(storyUuid);
      return;
    }

    /* Otherwise it's a game-world card with Unsplash credit */
    const card = btn.closest('[data-credit-artist]');
    let artist = 'paths.games';
    let url    = 'https://paths.games';

    if (card) {
      artist = card.getAttribute('data-credit-artist') || artist;
      url    = card.getAttribute('data-credit-url')    || url;
    }

    if (btn.hasAttribute('data-credit-artist')) {
      artist = btn.getAttribute('data-credit-artist') || artist;
      url    = btn.getAttribute('data-credit-url')    || url;
    }

    /* Populate info modal — Unsplash style */
    document.getElementById('info-artist-name').textContent = artist;
    const link = document.getElementById('info-artist-link');
    link.href = url;
    link.textContent = 'View ' + artist + ' on Unsplash';
    link.style.display = '';

    /* Hide copyright area for Unsplash cards */
    document.getElementById('info-copyright-area').style.display = 'none';

    new bootstrap.Modal(document.getElementById('infoModal')).show();
  });

  /* Show copyright info from API card data */
  async function showStoryCopyrightInfo(uuid) {
    const story = stories.find(s => s.uuid === uuid);
    if (!story) return;

    /* Try to get full card info */
    let detail = null;
    if (!usingMock && currentServer !== 'mock' && story.card && story.card.uuid) {
      try {
        detail = await fetchCardDetail(uuid, story.card.uuid);
      } catch {
        detail = getMockCardDetail(story.card?.uuid);
      }
    } else {
      detail = getMockCardDetail(story.card?.uuid);
    }

    /* Also try story detail for copyrightText/linkCopyright */
    let sDetail = storyDetail;
    if (!sDetail || sDetail.uuid !== uuid) {
      if (!usingMock && currentServer !== 'mock') {
        try { sDetail = await fetchStoryDetail(uuid); } catch { sDetail = getMockDetail(uuid); }
      } else {
        sDetail = getMockDetail(uuid);
      }
    }

    /* Build info modal content */
    const artistName = detail?.creator?.name || story.author || 'Paths Games';
    const artistLink = detail?.creator?.link || 'https://paths.games';

    document.getElementById('info-artist-name').textContent = artistName;
    const link = document.getElementById('info-artist-link');
    link.href = artistLink;
    link.textContent = 'Visit ' + artistName;
    link.style.display = artistLink ? '' : 'none';

    /* Copyright area — link_copyright + copyrightText from API */
    const copyrightArea = document.getElementById('info-copyright-area');
    const copyrightText = detail?.copyrightText || sDetail?.copyrightText || null;
    const linkCopyright = detail?.linkCopyright || sDetail?.linkCopyright || null;

    if (copyrightText || linkCopyright) {
      copyrightArea.style.display = '';
      document.getElementById('info-copyright-text').textContent = copyrightText || '';
      const cLink = document.getElementById('info-copyright-link');
      if (linkCopyright) {
        cLink.href = linkCopyright;
        cLink.style.display = '';
        document.getElementById('info-copyright-link-text').textContent = 'View Copyright';
      } else {
        cLink.style.display = 'none';
      }
    } else {
      copyrightArea.style.display = 'none';
    }

    new bootstrap.Modal(document.getElementById('infoModal')).show();
  }

  /* Close game (click brand while playing) */
  document.querySelector('.navbar-brand')?.addEventListener('click', e => {
    if (activeStory) { e.preventDefault(); stopStory(); }
  });

  /* ══════════════════════════════════════════
     CHOICE POPUP
     ══════════════════════════════════════════ */
  function showPopup(msg) {
    document.querySelectorAll('.choice-popup').forEach(el => el.remove());
    const div = document.createElement('div');
    div.className = 'choice-popup';
    div.textContent = msg;
    document.body.appendChild(div);
    div.addEventListener('animationend', () => div.remove());
  }

  /* ══════════════════════════════════════════
     CARD STAGGERED ENTRANCE
     ══════════════════════════════════════════ */
  function initEntrance() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const delay = i * 0.08;
          entry.target.style.animationDelay = delay + 's';
          entry.target.style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.location-card, .go-card, .action-card').forEach(card => {
      card.style.animationPlayState = 'paused';
      observer.observe(card);
    });
  }

  /* ══════════════════════════════════════════
     DRAG-SCROLL
     ══════════════════════════════════════════ */
  function initDragScroll(row) {
    let isDown = false, startX, scrollLeft;
    row.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      isDown = true; row.classList.add('grabbing');
      startX = e.pageX - row.offsetLeft;
      scrollLeft = row.scrollLeft;
    });
    row.addEventListener('mouseleave', () => { isDown = false; row.classList.remove('grabbing'); });
    row.addEventListener('mouseup',    () => { isDown = false; row.classList.remove('grabbing'); });
    row.addEventListener('mousemove',  e  => {
      if (!isDown) return; e.preventDefault();
      row.scrollLeft = scrollLeft - (e.pageX - row.offsetLeft - startX) * 1.5;
    });
  }

  /* ══════════════════════════════════════════
     SERVER SELECTOR
     ══════════════════════════════════════════ */
  function initServerSelector() {
    const sel = $('#server-select');
    if (!sel) return;

    for (const [key, cfg] of Object.entries(SERVERS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = cfg.label;
      if (key === currentServer) opt.selected = true;
      sel.appendChild(opt);
    }

    sel.addEventListener('change', async () => {
      currentServer = sel.value;
      if (activeStory) stopStory();
      await loadStories();
    });
  }

  /* ══════════════════════════════════════════
     USER BUTTON
     ══════════════════════════════════════════ */
  document.getElementById('btn-user')?.addEventListener('click', () => {
    showPopup('✦ Login is not yet available — continuing as guest ✦');
  });

  /* ══════════════════════════════════════════
     INIT
     ══════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', async () => {
    initHero();
    initServerSelector();
    await loadStories();
  });

})();

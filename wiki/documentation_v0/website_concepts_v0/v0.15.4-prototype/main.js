/* =============================================
   PATHS GAMES — main.js  (v0.15.4-prototype)
   Story catalog, game bar, location navigator
   All cards: image-first, 3D, Unsplash credits
   ============================================= */
(function () {

  /* ══════════════════════════════════════════
     APP STATE
     ══════════════════════════════════════════ */
  let currentId = null;
  let navHistory = [];
  let activeStory = null;

  /* Options state */
  let optionStep = 0;
  let selectedOptions = {};
  let termsAccepted = false;

  /* Option images — Unsplash */
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

  /* DOM refs */
  const elCatalog   = document.getElementById('story-catalog');
  const elWorld     = document.getElementById('world');
  const elGameBar   = document.getElementById('game-bar');
  const elBarTitle  = document.getElementById('game-bar-title');
  const btnMap      = document.getElementById('btn-map');
  const btnJournal  = document.getElementById('btn-journal');
  const elHero      = document.getElementById('hero-banner');

  /* ══════════════════════════════════════════
     HERO IMAGE SETUP
     ══════════════════════════════════════════ */
  function initHero() {
    const heroImg = document.getElementById('hero-img');
    const heroInfoBtn = document.getElementById('hero-info-btn');
    if (heroImg && HERO_IMAGE) {
      heroImg.src = HERO_IMAGE.url;
      heroImg.alt = 'Medieval Castle — Photo by ' + HERO_IMAGE.artist;
    }
    if (heroInfoBtn && HERO_IMAGE) {
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

  /* ══════════════════════════════════════════
     STORY CATALOG — Netflix-style, image-first cards
     ══════════════════════════════════════════ */
  function renderCatalog() {
    const cats = {};
    STORIES.forEach(s => {
      if (!cats[s.category]) cats[s.category] = [];
      cats[s.category].push(s);
    });

    let html = '';
    for (const [cat, stories] of Object.entries(cats)) {
      html += `<div class="catalog-category">`;
      html += `<h3 class="catalog-cat-title">${cat}</h3>`;
      html += `<div class="catalog-row">`;
      stories.forEach(s => {
        const playable = !!s.startLocation;
        const coverHTML = s.cover
          ? `<img src="${s.cover}" alt="${s.title}" class="catalog-card-img"/>`
          : `<span class="catalog-card-emote">${s.emote}</span>`;
        const btnClass  = playable ? 'catalog-play-btn' : 'catalog-play-btn catalog-play-btn-disabled';
        const btnLabel  = playable ? '<i class="fas fa-play me-1"></i>Play' : 'Coming soon';
        const creditArtist = s.coverCredit ? s.coverCredit.artist : 'paths.games';
        const creditUrl    = s.coverCredit ? s.coverCredit.url : 'https://paths.games';

        /* Card: image → title → button → (i) */
        html += `
          <div class="catalog-card card-dimension-normal card-3d"
               data-story="${s.id}"
               data-credit-artist="${creditArtist}"
               data-credit-url="${creditUrl}">
            <div class="catalog-card-cover">${coverHTML}</div>
            <div class="catalog-title-plate card-decorative"><span>${s.title}</span></div>
            <button class="${btnClass}" ${playable ? `data-story="${s.id}"` : 'disabled'}>${btnLabel}</button>
            <div class="catalog-info-footer">
              <button class="card-info-btn" title="Photo credit"><i class="fas fa-info-circle"></i></button>
            </div>
          </div>`;
      });
      html += `</div></div>`;
    }

    elCatalog.innerHTML = html;

    /* Bind play buttons */
    elCatalog.querySelectorAll('.catalog-play-btn:not(.catalog-play-btn-disabled)').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        showStoryPreview(btn.dataset.story);
      });
    });

    /* Horizontal drag-scroll */
    elCatalog.querySelectorAll('.catalog-row').forEach(row => {
      let isDown = false, startX, scrollLeft;
      row.addEventListener('mousedown', e => { isDown = true; row.classList.add('grabbing'); startX = e.pageX - row.offsetLeft; scrollLeft = row.scrollLeft; });
      row.addEventListener('mouseleave', () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mouseup',    () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mousemove',  e  => { if (!isDown) return; e.preventDefault(); row.scrollLeft = scrollLeft - (e.pageX - row.offsetLeft - startX) * 1.5; });
    });
  }

  /* ══════════════════════════════════════════
     STORY PREVIEW MODAL — image + title only (no desc)
     ══════════════════════════════════════════ */
  let pendingStoryId = null;

  function showStoryPreview(storyId) {
    const story = STORIES.find(s => s.id === storyId);
    if (!story) return;
    pendingStoryId = storyId;
    optionStep = 0;
    selectedOptions = {};
    termsAccepted = false;

    document.getElementById('preview-modal-title').textContent = story.title;

    const body = document.getElementById('story-preview-body');
    const coverHTML = story.cover
      ? `<img src="${story.cover}" alt="${story.title}" class="preview-visual-img" style="width:100%;height:100%;object-fit:cover;" />`
      : `<span class="preview-visual-emote">${story.emote}</span>`;
    const creditArtist = story.coverCredit ? story.coverCredit.artist : 'paths.games';
    const creditUrl    = story.coverCredit ? story.coverCredit.url : 'https://paths.games';

    /* Preview card: image → title → (i) — NO description */
    body.innerHTML = `
      <div class="story-preview-main card-dimension-large card-3d"
           data-credit-artist="${creditArtist}"
           data-credit-url="${creditUrl}">
        <div class="preview-visual">${coverHTML}</div>
        <div class="preview-title-plate card-decorative"><span>${story.title}</span></div>
        <div class="preview-info-footer">
          <button class="card-info-btn" title="Photo credit"><i class="fas fa-info-circle"></i></button>
        </div>
      </div>
      <div class="story-preview-options" id="story-preview-options"></div>`;

    renderOptionsStep();
    new bootstrap.Modal(document.getElementById('storyPreviewModal')).show();
  }

  /* ══════════════════════════════════════════
     OPTIONS STEP — image-first option cards
     ══════════════════════════════════════════ */
  function renderOptionsStep() {
    const container = document.getElementById('story-preview-options');
    if (!container) return;

    if (optionStep < STORY_OPTIONS.length) {
      const group = STORY_OPTIONS[optionStep];
      let html = '';
      html += `<h4 class="options-step-title"><i class="${group.icon} me-2"></i>${group.option}</h4>`;
      html += `<div class="options-cards-row">`;

      group.values.forEach(val => {
        const disabledClass = val.disabled ? 'option-disabled' : '';
        const btnDisabled   = val.disabled ? 'disabled' : '';
        const btnLabel      = val.disabled ? '<i class="fas fa-lock me-1"></i>Locked' : '<i class="fas fa-check me-1"></i>Select';
        const imgHTML       = val.image
          ? `<img src="${val.image}" alt="${val.label}" />`
          : `<i class="${val.icon}"></i>`;
        const creditArtist  = val.credit ? val.credit.artist : 'paths.games';
        const creditUrl     = val.credit ? val.credit.url : 'https://paths.games';

        /* Option card: image → title → button */
        html += `
          <div class="option-card card-dimension-little ${disabledClass} card-3d"
               data-value="${val.label}"
               data-credit-artist="${creditArtist}"
               data-credit-url="${creditUrl}">
            <div class="option-visual">${imgHTML}</div>
            <div class="option-title-plate card-decorative"><span>${val.label}</span></div>
            <button class="option-select-btn" ${btnDisabled}>${btnLabel}</button>
          </div>`;
      });
      html += `</div>`;

      if (Object.keys(selectedOptions).length > 0) {
        html += `<div class="options-summary">`;
        for (const [key, value] of Object.entries(selectedOptions)) {
          html += `<span class="option-summary-badge"><i class="fas fa-check-circle me-1"></i>${key}: ${value}</span>`;
        }
        html += `</div>`;
      }

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

  /* ══════════════════════════════════════════
     LOGIN STEP — image-first cards
     ══════════════════════════════════════════ */
  function renderLoginStep() {
    const container = document.getElementById('story-preview-options');
    if (!container) return;

    let html = `<h4 class="options-step-title"><i class="fas fa-user-circle me-2"></i>Login</h4>`;
    html += `<div class="options-cards-row">`;

    /* Guest */
    const g = LOGIN_IMAGES.guest;
    html += `
      <div class="option-card card-dimension-little card-3d" data-value="guest"
           data-credit-artist="${g.credit.artist}" data-credit-url="${g.credit.url}">
        <div class="option-visual"><img src="${g.image}" alt="Guest" /></div>
        <div class="option-title-plate card-decorative"><span>Guest</span></div>
        <button class="option-select-btn" id="btn-login-guest"><i class="fas fa-play me-1"></i>Guest</button>
      </div>`;

    /* Register (disabled) */
    const r = LOGIN_IMAGES.register;
    html += `
      <div class="option-card card-dimension-little option-disabled card-3d" data-value="register"
           data-credit-artist="${r.credit.artist}" data-credit-url="${r.credit.url}">
        <div class="option-visual"><img src="${r.image}" alt="Register" /></div>
        <div class="option-title-plate card-decorative"><span>Register</span></div>
        <button class="option-select-btn" disabled><i class="fas fa-lock me-1"></i>Register</button>
      </div>`;

    /* Login (disabled) */
    const l = LOGIN_IMAGES.login;
    html += `
      <div class="option-card card-dimension-little option-disabled card-3d" data-value="login"
           data-credit-artist="${l.credit.artist}" data-credit-url="${l.credit.url}">
        <div class="option-visual"><img src="${l.image}" alt="Login" /></div>
        <div class="option-title-plate card-decorative"><span>Login</span></div>
        <button class="option-select-btn" disabled><i class="fas fa-lock me-1"></i>Login</button>
      </div>`;

    html += `</div>`;
    html += `<div class="options-summary">`;
    for (const [key, value] of Object.entries(selectedOptions)) {
      html += `<span class="option-summary-badge"><i class="fas fa-check-circle me-1"></i>${key}: ${value}</span>`;
    }
    html += `</div>`;

    container.innerHTML = html;

    container.querySelector('#btn-login-guest')?.addEventListener('click', e => {
      e.stopPropagation();
      selectedOptions['Login'] = 'Guest';
      renderFinalOptions();
    });
    add3dEffect();
  }

  /* ══════════════════════════════════════════
     FINAL OPTIONS — image-first cards
     ══════════════════════════════════════════ */
  function renderFinalOptions() {
    const container = document.getElementById('story-preview-options');
    if (!container) return;

    let summaryHTML = `<div class="options-summary">`;
    for (const [key, value] of Object.entries(selectedOptions)) {
      summaryHTML += `<span class="option-summary-badge"><i class="fas fa-check-circle me-1"></i>${key}: ${value}</span>`;
    }
    summaryHTML += `</div>`;

    const checkVisual = termsAccepted
      ? `<i class="fas fa-check-square" style="font-size:3rem;color:var(--color-gold-light);"></i>`
      : `<span class="option-terms-notice">To play you must read and accept
          <button class="option-terms-info" id="btn-terms-info" title="Read Terms">the terms of conditions</button>
        </span>`;
    const startDisabled     = termsAccepted ? '' : 'disabled';
    const startOpacity      = termsAccepted ? '' : 'option-btn-disabled';
    const startCardOpacity  = termsAccepted ? '' : 'option-disabled';
    const termsCardOpacity  = termsAccepted ? 'option-disabled' : '';

    const t = FINAL_IMAGES.terms;
    const s = FINAL_IMAGES.start;

    let html = `<h4 class="options-step-title"><i class="fas fa-play me-2"></i>Ready to Play</h4>`;
    html += `<div class="options-cards-row">`;

    /* Terms card */
    html += `
      <div class="option-card card-dimension-little final-card ${termsCardOpacity} card-3d"
           data-credit-artist="${t.credit.artist}" data-credit-url="${t.credit.url}">
        <div class="option-visual">
          ${termsAccepted ? checkVisual : `<img src="${t.image}" alt="Terms" />`}
        </div>
        <div class="option-title-plate card-decorative"><span>Terms</span></div>
        <button class="option-select-btn" id="btn-accept-terms">
          <i class="fas fa-check me-1"></i>${termsAccepted ? 'Accepted' : 'Accept'}
        </button>
      </div>`;

    /* Start card */
    html += `
      <div class="option-card card-dimension-little final-card ${startCardOpacity} card-3d"
           data-credit-artist="${s.credit.artist}" data-credit-url="${s.credit.url}">
        <div class="option-visual"><img src="${s.image}" alt="Start Adventure" /></div>
        <div class="option-title-plate card-decorative"><span>Start</span></div>
        <button class="option-select-btn ${startOpacity}" id="btn-start-adventure" ${startDisabled}>
          <i class="fas fa-play me-1"></i>Start
        </button>
      </div>`;

    html += `</div>`;
    html += summaryHTML;

    container.innerHTML = html;

    container.querySelector('#btn-terms-info')?.addEventListener('click', e => {
      e.stopPropagation();
      new bootstrap.Modal(document.getElementById('termsModal')).show();
    });
    container.querySelector('#btn-accept-terms')?.addEventListener('click', e => {
      e.stopPropagation();
      termsAccepted = !termsAccepted;
      renderFinalOptions();
    });
    container.querySelector('#btn-start-adventure')?.addEventListener('click', e => {
      e.stopPropagation();
      if (!termsAccepted || !pendingStoryId) return;
      const modal = bootstrap.Modal.getInstance(document.getElementById('storyPreviewModal'));
      if (modal) modal.hide();
      startStory(pendingStoryId);
      pendingStoryId = null;
    });
    add3dEffect();
  }

  /* Modal Play button (fallback) */
  document.getElementById('btn-preview-play')?.addEventListener('click', () => {
    if (!pendingStoryId) return;
    const modal = bootstrap.Modal.getInstance(document.getElementById('storyPreviewModal'));
    if (modal) modal.hide();
    startStory(pendingStoryId);
    pendingStoryId = null;
  });

  /* ══════════════════════════════════════════
     START / STOP STORY
     ══════════════════════════════════════════ */
  function startStory(storyId) {
    const story = STORIES.find(s => s.id === storyId);
    if (!story || !story.startLocation) return;
    activeStory = story;
    currentId   = story.startLocation;
    navHistory  = [];

    elCatalog.style.display  = 'none';
    elWorld.style.display    = '';
    elGameBar.style.display  = '';
    elHero.style.display     = 'none';
    elBarTitle.textContent   = story.title;

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
    const locMap = STORIES_LOCATIONS[activeStory.id] || {};
    const loc    = locMap[id];
    if (!loc) return;
    currentId = id;

    const creditAttr = (c) => c ? `data-credit-artist="${c.artist}" data-credit-url="${c.url}"` : '';

    /* ── Location card: image → title → desc → (i) ── */
    const visualHTML = loc.image
      ? `<img src="${loc.image}" alt="${loc.title}" class="card-visual-img" />`
      : `<span class="card-visual-emote">${loc.emote}</span>`;

    const locationCardHTML = `
      <div class="location-card card-dimension-large card-3d" ${creditAttr(loc.imageCredit)}>
        <div class="card-visual">${visualHTML}</div>
        <div class="card-title-plate card-decorative">
          <span>${loc.title}</span>
          <i class="${loc.icon} card-plate-icon"${loc.iconColor ? ` style="color:${loc.iconColor}"` : ''}></i>
        </div>
        <div class="card-desc-area">
          <p>${loc.desc}</p>
          <button class="card-info-btn" title="Photo credit"><i class="fas fa-info-circle"></i></button>
        </div>
      </div>`;

    /* ── Neighbor (go) cards: image → title → (i) ── */
    const goCardsHTML = (loc.neighbors || []).map(nid => {
      const n = locMap[nid];
      if (!n) return '';
      const nVisual = n.image
        ? `<img src="${n.image}" alt="${n.title}" class="choice-visual-img" />`
        : `<span class="choice-visual-emote">${n.emote}</span>`;
      return `
        <div class="choice-card card-dimension-normal go-card card-3d" data-target="${n.id}" ${creditAttr(n.imageCredit)}>
          <div class="choice-visual">${nVisual}</div>
          <div class="choice-title-plate card-decorative">
            <span>${n.title}</span>
            <i class="${n.icon} choice-plate-icon"${n.iconColor ? ` style="color:${n.iconColor}"` : ''}></i>
          </div>
          <div class="choice-info-footer">
            <button class="card-info-btn" title="Photo credit"><i class="fas fa-info-circle"></i></button>
          </div>
        </div>`;
    }).join('');

    /* ── Action cards: image → title → (i) ── */
    const actionCardsHTML = (loc.actions || []).map(a => {
      const aVisual = a.image
        ? `<img src="${a.image}" alt="${a.title}" class="choice-visual-img" />`
        : `<span class="choice-visual-emote">${a.emote}</span>`;
      return `
        <div class="choice-card card-dimension-normal action-card card-3d" data-action="${a.id}" ${creditAttr(a.imageCredit)}>
          <div class="choice-visual">${aVisual}</div>
          <div class="choice-title-plate card-decorative">
            <span>${a.title}</span>
            <i class="${a.icon} choice-plate-icon"></i>
          </div>
          <div class="choice-info-footer">
            <button class="card-info-btn" title="Photo credit"><i class="fas fa-info-circle"></i></button>
          </div>
        </div>`;
    }).join('');

    /* ── Build scene ── */
    const scene = document.createElement('div');
    scene.className = 'game-scene';
    scene.innerHTML = `
      <div class="game-location-panel">${locationCardHTML}</div>
      <div class="game-right-panel">
        <div class="game-row">
          <h3 class="game-row-title"><i class="fas fa-compass me-2"></i>Nearby Locations</h3>
          <div class="game-row-scroll go-cards-scroll">${goCardsHTML || '<span class="game-row-empty">No paths lead further.</span>'}</div>
        </div>
        <div class="game-row">
          <h3 class="game-row-title"><i class="fas fa-scroll me-2"></i>Available Actions</h3>
          <div class="game-row-scroll action-cards-scroll">${actionCardsHTML || '<span class="game-row-empty">Nothing to do here.</span>'}</div>
        </div>
      </div>`;

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
    /* Go-cards */
    document.querySelectorAll('.go-card[data-target]').forEach(card => {
      card.addEventListener('click', () => {
        const locMap = STORIES_LOCATIONS[activeStory?.id] || {};
        const n = locMap[card.dataset.target];
        if (!n) return;
        showCardModal(n, 'go', card.dataset.target);
      });
    });

    /* Action-cards */
    document.querySelectorAll('.action-card[data-action]').forEach(card => {
      card.addEventListener('click', () => {
        const locMap = STORIES_LOCATIONS[activeStory?.id] || {};
        const loc    = locMap[currentId];
        const action = (loc?.actions || []).find(a => a.id === card.dataset.action);
        if (!action) return;
        showCardModal(action, 'action', card.dataset.action);
      });
    });

    /* Horizontal drag-scroll */
    document.querySelectorAll('.game-row-scroll').forEach(row => {
      let isDown = false, startX, scrollLeft;
      row.addEventListener('mousedown', e => { isDown = true; row.classList.add('grabbing'); startX = e.pageX - row.offsetLeft; scrollLeft = row.scrollLeft; });
      row.addEventListener('mouseleave', () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mouseup',    () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mousemove',  e  => { if (!isDown) return; e.preventDefault(); row.scrollLeft = scrollLeft - (e.pageX - row.offsetLeft - startX) * 1.5; });
    });

    initEntrance();
  }

  /* ══════════════════════════════════════════
     CARD DETAIL MODAL — image-first, 3D
     ══════════════════════════════════════════ */
  function showCardModal(data, type, id) {
    const isGo = type === 'go';
    const visual = data.image
      ? `<img src="${data.image}" alt="${data.title}" />`
      : `<span class="card-detail-emote">${data.emote}</span>`;
    const confirmLabel = isGo
      ? '<i class="fas fa-shoe-prints me-2"></i>Move'
      : '<i class="fas fa-scroll me-2"></i>Proceed';
    const iconAttr = data.icon
      ? `<i class="${data.icon} card-plate-icon"${data.iconColor ? ` style="color:${data.iconColor}"` : ''}></i>`
      : '';
    const creditArtist = data.imageCredit ? data.imageCredit.artist : 'paths.games';
    const creditUrl    = data.imageCredit ? data.imageCredit.url : 'https://paths.games';

    /* Modal card: image → title → desc → button → (i) */
    document.getElementById('card-detail-inner').innerHTML = `
      <div class="card-detail-wrapper">
        <button class="card-detail-close" data-bs-dismiss="modal" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
        <div class="card-detail-card card-dimension-large card-3d"
             data-credit-artist="${creditArtist}"
             data-credit-url="${creditUrl}">
          <div class="card-detail-visual">${visual}</div>
          <div class="card-title-plate card-decorative">
            <span>${data.title}</span>${iconAttr}
          </div>
          <p class="card-detail-desc">${data.desc}</p>
          <div class="card-detail-footer">
            <button class="story-preview-play-btn" id="btn-card-confirm">${confirmLabel}</button>
            <button class="card-info-btn" title="Photo credit"><i class="fas fa-info-circle"></i></button>
          </div>
        </div>
      </div>`;

    document.getElementById('btn-card-confirm').addEventListener('click', () => {
      bootstrap.Modal.getInstance(document.getElementById('cardDetailModal'))?.hide();
      if (isGo) navigateTo(id);
      else showPopup(`✦ ${data.title}: coming soon… ✦`);
    });

    new bootstrap.Modal(document.getElementById('cardDetailModal')).show();
    /* Re-init 3D after modal renders */
    setTimeout(() => add3dEffect(), 100);
  }

  /* ══════════════════════════════════════════
     GAME BAR EVENTS
     ══════════════════════════════════════════ */
  btnMap?.addEventListener('click', () => showPopup('✦ The map is not yet available… ✦'));
  btnJournal?.addEventListener('click', () => showPopup('✦ The journal is not yet available… ✦'));
  document.getElementById('btn-inventory')?.addEventListener('click', () => showPopup('✦ The inventory is not yet available… ✦'));

  /* ══════════════════════════════════════════
     (i) INFO BUTTON — show artist credit modal
     ══════════════════════════════════════════ */
  document.addEventListener('click', e => {
    const btn = e.target.closest('.card-info-btn');
    if (!btn) return;
    e.stopPropagation();

    /* Find nearest card with credit data */
    const card = btn.closest('[data-credit-artist]');
    let artist = 'paths.games';
    let url    = 'https://paths.games';

    if (card) {
      artist = card.getAttribute('data-credit-artist') || artist;
      url    = card.getAttribute('data-credit-url')    || url;
    }

    /* Also check if the btn itself has the data (hero) */
    if (btn.hasAttribute('data-credit-artist')) {
      artist = btn.getAttribute('data-credit-artist') || artist;
      url    = btn.getAttribute('data-credit-url')    || url;
    }

    /* Populate info modal */
    document.getElementById('info-artist-name').textContent = artist;
    const link = document.getElementById('info-artist-link');
    link.href = url;
    link.textContent = `View ${artist} on Unsplash`;

    new bootstrap.Modal(document.getElementById('infoModal')).show();
  });

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
          entry.target.style.animationDelay = `${delay}s`;
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
     NAVBAR BADGE CAROUSEL
     ══════════════════════════════════════════ */
  function initBadgeCarousel() {
    const badges = document.querySelectorAll('.navbar-badges-to-rotate .navbar-badge');
    if (!badges.length) return;
    let current = 0;
    badges[0].classList.add('active');
    setInterval(() => {
      const prev = current;
      current = (current + 1) % badges.length;
      badges[prev].classList.remove('active');
      badges[prev].classList.add('exit-up');
      badges[current].classList.add('active');
      setTimeout(() => badges[prev].classList.remove('exit-up'), 500);
    }, 3000);
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
  initHero();
  renderCatalog();
  initBadgeCarousel();

})();

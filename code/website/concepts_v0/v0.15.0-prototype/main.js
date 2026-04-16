/* =============================================
   PATHS GAMES — v0.15.0-prototype — main.js
   
   Story catalog loaded from backend REST API.
   Locations, actions, and choices from static JSON.
   
   API endpoints used (Step 14 & 15):
     GET /api/stories               — list public stories
     GET /api/stories/{uuid}        — story detail (enriched)
     GET /api/stories/categories    — distinct categories
     GET /api/stories/category/{c}  — stories by category
   
   Static data (stories.js):
     STORIES_LOCATIONS  — location/action/choice data
     LOCAL_STORY_CONFIG — emote/startLocation mapping
     FALLBACK_STORIES   — used when API is unreachable
   ============================================= */
(function () {
  'use strict';

  /* ══════════════════════════════════════════
     APP STATE
     ══════════════════════════════════════════ */
  let stories       = [];        // Populated from API or fallback
  let storyDetails  = {};        // Cached detail responses keyed by uuid/id
  let currentId     = null;      // Current location id
  let navHistory    = [];
  let activeStory   = null;      // Currently playing story object
  let apiAvailable  = false;     // Whether the API responded successfully
  let dataSource    = 'none';    // 'api' | 'fallback'

  /* Options state */
  let optionStep      = 0;
  let selectedOptions = {};
  let termsAccepted   = false;

  let currentStoryOptions = []; // Built dynamically per story from API detail

  const DIFFICULTY_ICONS = ['fas fa-feather', 'fas fa-shield-alt', 'fas fa-skull-crossbones', 'fas fa-skull', 'fas fa-fire'];
  const CHARACTER_ICONS  = ['fas fa-crown', 'fas fa-skull', 'fas fa-hat-wizard', 'fas fa-user-ninja', 'fas fa-user-shield'];
  const TRAIT_ICONS      = ['fas fa-star', 'fas fa-star-half-alt', 'fas fa-bolt', 'fas fa-heart', 'fas fa-shield-alt', 'fas fa-feather'];

  const STATIC_TYPE_STEP = {
    option: 'Type',
    icon: 'fas fa-gamepad',
    values: [
      { label: 'Single Player', icon: 'fas fa-user',   disabled: false },
      { label: 'Multiplayer',   icon: 'fas fa-users',  disabled: true  },
      { label: 'Open World',    icon: 'fas fa-globe',  disabled: true  }
    ]
  };

  const FALLBACK_DIFFICULTY_STEP = {
    option: 'Difficulty',
    icon: 'fas fa-skull-crossbones',
    values: [
      { label: 'Easy',   icon: 'fas fa-feather',          disabled: false },
      { label: 'Medium', icon: 'fas fa-shield-alt',        disabled: true  },
      { label: 'Hard',   icon: 'fas fa-skull-crossbones',  disabled: true  }
    ]
  };

  const FALLBACK_CHARACTER_STEP = {
    option: 'Character',
    icon: 'fas fa-user',
    values: [
      { label: 'Hero', icon: 'fas fa-crown',       disabled: false },
      { label: 'Evil', icon: 'fas fa-skull',        disabled: true  },
      { label: 'Poor', icon: 'fas fa-hat-wizard',   disabled: true  }
    ]
  };

  /**
   * Build the option steps for a story based on API detail data.
   * Flow: Difficulty → Character → Traits → Type → Login → Start
   */
  function buildStoryOptions(detail) {
    const steps = [];

    /* 1. Difficulty — from API or fallback */
    if (detail && detail.difficulties && detail.difficulties.length > 0) {
      steps.push({
        option: 'Difficulty',
        icon: 'fas fa-skull-crossbones',
        _fromApi: true,
        values: detail.difficulties.map((diff, i) => ({
          label: diff.description || `Difficulty ${i + 1}`,
          icon: DIFFICULTY_ICONS[i % DIFFICULTY_ICONS.length],
          disabled: false,
          subtitle: `EXP: ${diff.expCost ?? '?'} · Characters: ${diff.minCharacter ?? '?'}–${diff.maxCharacter ?? '?'}`,
          apiData: diff
        }))
      });
    } else {
      steps.push(FALLBACK_DIFFICULTY_STEP);
    }

    /* 2. Character — from API or fallback */
    if (detail && detail.characterTemplates && detail.characterTemplates.length > 0) {
      steps.push({
        option: 'Character',
        icon: 'fas fa-user',
        _fromApi: true,
        values: detail.characterTemplates.map((ct, i) => ({
          label: ct.name || `Character ${i + 1}`,
          icon: CHARACTER_ICONS[i % CHARACTER_ICONS.length],
          disabled: false,
          subtitle: ct.description || '',
          stats: `HP: ${ct.lifeMax ?? '?'} · EN: ${ct.energyMax ?? '?'} · DEX: ${ct.dexterityStart ?? '?'} · INT: ${ct.intelligenceStart ?? '?'} · CON: ${ct.constitutionStart ?? '?'}`,
          apiData: ct
        }))
      });
    } else {
      steps.push(FALLBACK_CHARACTER_STEP);
    }

    /* 3. Traits — from API (only added if available) */
    if (detail && detail.traits && detail.traits.length > 0) {
      steps.push({
        option: 'Traits',
        icon: 'fas fa-star-half-alt',
        _fromApi: true,
        values: detail.traits.map((t, i) => ({
          label: t.name || `Trait ${i + 1}`,
          icon: TRAIT_ICONS[i % TRAIT_ICONS.length],
          disabled: false,
          subtitle: t.description || '',
          stats: `Cost: +${t.costPositive ?? 0} / −${t.costNegative ?? 0}`,
          apiData: t
        }))
      });
    }

    /* 4. Type — static */
    steps.push(STATIC_TYPE_STEP);

    return steps;
  }

  /* DOM refs */
  const elCatalog    = document.getElementById('story-catalog');
  const elWorld      = document.getElementById('world');
  const elGameBar    = document.getElementById('game-bar');
  const elBarTitle   = document.getElementById('game-bar-title');
  const btnMap       = document.getElementById('btn-map');
  const btnJournal   = document.getElementById('btn-journal');
  const elCrowdfund  = document.getElementById('crowdfund');
  const elApiBase    = document.getElementById('api-base');
  const elLang       = document.getElementById('lang-select');
  const elApiStatus  = document.getElementById('api-status');
  const elLoading    = document.getElementById('catalog-loading');

  /* ══════════════════════════════════════════
     API HELPERS
     ══════════════════════════════════════════ */
  function apiBase() {
    return (elApiBase ? elApiBase.value : 'http://localhost:8042/api').replace(/\/+$/, '');
  }

  function lang() {
    return elLang ? elLang.value : 'en';
  }

  /**
   * Fetch from the backend API.
   * Returns parsed JSON on success, null on failure.
   */
  async function apiFetch(path) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${apiBase()}${path}${sep}lang=${lang()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[API] Failed: ${url}`, err.message);
      return null;
    }
  }

  function setApiStatus(text, ok) {
    if (!elApiStatus) return;
    elApiStatus.textContent = text;
    elApiStatus.className = 'api-status ' + (ok ? 'api-ok' : 'api-err');
  }

  /* ══════════════════════════════════════════
     LOCAL CONFIG HELPERS
     ══════════════════════════════════════════ */

  /**
   * Find local config for an API story (by title match).
   * Returns { localId, emote, startLocation } or default.
   */
  function getLocalConfig(story) {
    const titleKey = (story.title || '').toLowerCase().trim();
    const byTitle = LOCAL_STORY_CONFIG._by_title || {};
    if (byTitle[titleKey]) return byTitle[titleKey];
    return LOCAL_STORY_CONFIG._default || { emote: '📜', startLocation: null };
  }

  /**
   * Convert an API story summary to the internal format
   * used by the catalog renderer.
   */
  function apiStoryToInternal(apiStory) {
    const local = getLocalConfig(apiStory);
    return {
      id:            apiStory.uuid || local.localId || apiStory.title,
      uuid:          apiStory.uuid || null,
      title:         apiStory.title || 'Untitled',
      category:      capitalize(apiStory.category || 'Uncategorized'),
      group:         apiStory.group || null,
      emote:         local.emote,
      cover:         null,   // Will be enriched from story detail (card.imageUrl)
      desc:          apiStory.description || '',
      startLocation: local.startLocation,
      author:        apiStory.author || null,
      priority:      apiStory.priority || 0,
      peghi:         apiStory.peghi || 0,
      difficultyCount: apiStory.difficultyCount || 0,
      _fromApi:      true
    };
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  /* ══════════════════════════════════════════
     MAGIC CODE GENERATOR
     ══════════════════════════════════════════ */
  const RUNES  = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛇᛈᛋᛏᛒᛖᛚᛞᛟᛠᛡᛣ';
  const HEX    = '0123456789abcdef';
  const GLYPHS = '†‡§¶♠♣♥♦★✶✷✻❁❖◆◊•×÷≈∞∴∵≡';

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
     LOAD STORIES — API with fallback
     ══════════════════════════════════════════ */

  /**
   * Main data loading function.
   * 1. Try to fetch stories from GET /api/stories
   * 2. If API is unreachable, use FALLBACK_STORIES
   * 3. Group by category and render catalog
   */
  async function loadStories() {
    if (elLoading) elLoading.style.display = '';

    // Try API first
    const apiStories = await apiFetch('/stories');

    if (apiStories && Array.isArray(apiStories) && apiStories.length > 0) {
      // API succeeded — map to internal format
      stories = apiStories.map(apiStoryToInternal);
      apiAvailable = true;
      dataSource = 'api';
      setApiStatus(`✓ ${stories.length} stories loaded from API`, true);
      console.log(`[API] Loaded ${stories.length} stories from backend`);
    } else {
      // API failed or empty — use static fallback
      stories = FALLBACK_STORIES.map(s => ({ ...s, _fromApi: false }));
      apiAvailable = false;
      dataSource = 'fallback';
      setApiStatus('✗ Using static fallback', false);
      console.warn('[API] Unreachable, using FALLBACK_STORIES');
    }

    if (elLoading) elLoading.style.display = 'none';
    renderCatalog();
  }


  /* ══════════════════════════════════════════
     STORY CATALOG — Netflix-style
     ══════════════════════════════════════════ */
  function renderCatalog() {
    /* Group stories by category */
    const cats = {};
    stories.forEach(s => {
      if (!cats[s.category]) cats[s.category] = [];
      cats[s.category].push(s);
    });

    let html = '';

    /* Data source indicator
    html += `<div class="data-source-badge">
      <i class="fas ${dataSource === 'api' ? 'fa-cloud' : 'fa-database'} me-1"></i>
      Data source: <strong>${dataSource === 'api' ? 'REST API' : 'Static JSON (fallback)'}</strong>
    </div>`;
     */

    for (const [cat, catStories] of Object.entries(cats)) {
      html += `<div class="catalog-category">`;
      html += `<h3 class="catalog-cat-title">${cat}</h3>`;
      html += `<div class="catalog-row">`;
      catStories.forEach(s => {
        const _local = getLocalConfig(s);
        const _localId = _local.localId || s.id;
        const playable = true ; //!!STORIES_LOCATIONS[_localId];
        const coverHTML = s.cover
          ? `<img src="${s.cover}" alt="${s.title}" class="catalog-card-img"/>`
          : `<span class="catalog-card-emote">${s.emote}</span>`;
        const btnClass  = playable ? 'catalog-play-btn' : 'catalog-play-btn catalog-play-btn-disabled';
        const btnLabel  = playable ? '<i class="fas fa-play me-1"></i>Play' : 'Coming soon';

        /* Badge: API or static */
        const sourceBadge = s._fromApi
          ? '<span class="source-tag source-api"><i class="fas fa-cloud"></i> API</span>'
          : '<span class="source-tag source-static"><i class="fas fa-database"></i> Static</span>';
          

        html += `
          <div class="catalog-card card-dimension-normal" data-story="${s.id}">
            <div class="catalog-title-plate">
              <span>${s.title}</span>
            </div>
            <div class="catalog-body">
              <div class="catalog-card-cover">${coverHTML}</div>
              <div class="catalog-desc-area"><p>${s.desc}</p></div>
            </div>
            ${sourceBadge}
            <button class="${btnClass}" ${playable ? `data-story="${s.id}"` : 'disabled'}>${btnLabel}</button>
            <div class="catalog-magic-footer"><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
          </div>`;
      });
      html += `</div></div>`;
    }

    elCatalog.innerHTML = html;

    /* Bind play buttons */
    elCatalog.querySelectorAll('.catalog-play-btn:not(.catalog-play-btn-disabled)').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const storyId = btn.dataset.story;
        showStoryPreview(storyId);
      });
    });

    /* Horizontal drag-scroll for each row */
    elCatalog.querySelectorAll('.catalog-row').forEach(row => {
      let isDown = false, startX, scrollLeft;
      row.addEventListener('mousedown', e => { isDown = true; row.classList.add('grabbing'); startX = e.pageX - row.offsetLeft; scrollLeft = row.scrollLeft; });
      row.addEventListener('mouseleave', () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mouseup', () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mousemove', e => { if (!isDown) return; e.preventDefault(); row.scrollLeft = scrollLeft - (e.pageX - row.offsetLeft - startX) * 1.5; });
    });
  }


  /* ══════════════════════════════════════════
     STORY PREVIEW MODAL
     ══════════════════════════════════════════ */
  let pendingStoryId = null;

  async function showStoryPreview(storyId) {
    const story = stories.find(s => s.id === storyId);
    if (!story) return;
    pendingStoryId = storyId;

    /* Reset options state */
    optionStep      = 0;
    selectedOptions = {};
    termsAccepted   = false;

    /* Modal title */
    document.getElementById('preview-modal-title').textContent = story.title;

    /* Build body — show loading while fetching detail */
    const body = document.getElementById('story-preview-body');
    const coverHTML = story.cover
      ? `<img src="${story.cover}" alt="${story.title}" class="preview-visual-img" style="width:100%;height:100%;object-fit:cover;" />`
      : `<span class="preview-visual-emote">${story.emote}</span>`;

    body.innerHTML = `
      <div class="story-preview-main card-dimension-large">
        <div class="preview-title-plate"><span>${story.title}</span></div>
        <div class="preview-visual">${coverHTML}</div>
        <div class="preview-desc">
          <p>${story.desc}</p>
          <button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button>
        </div>
        <div class="preview-magic">${magicCode(24)}</div>
      </div>
      <div class="story-preview-options" id="story-preview-options">
        <div class="api-detail-loading">
          <i class="fas fa-spinner fa-spin"></i> Loading story details from API…
        </div>
      </div>`;

    /* Show modal */
    const modal = new bootstrap.Modal(document.getElementById('storyPreviewModal'));
    modal.show();

    /* Fetch story detail from API (if available) */
    let detail = null;
    if (apiAvailable && story.uuid) {
      detail = await apiFetch(`/stories/${story.uuid}`);
      if (detail) {
        storyDetails[storyId] = detail;
        console.log(`[API] Story detail loaded for "${story.title}":`, detail);

        /* Update cover image from card if available */
        if (detail.card && detail.card.imageUrl && !story.cover) {
          story.cover = detail.card.imageUrl;
          const previewVisual = body.querySelector('.preview-visual');
          if (previewVisual) {
            previewVisual.innerHTML = `<img src="${detail.card.imageUrl}" alt="${story.title}" class="preview-visual-img" style="width:100%;height:100%;object-fit:cover;" />`;
          }
        }
      }
    }

    /* Build dynamic option steps from API detail */
    currentStoryOptions = buildStoryOptions(detail);
    console.log(`[Options] Built ${currentStoryOptions.length} steps:`, currentStoryOptions.map(s => s.option));

    /* Render options (works regardless of API detail success) */
    renderOptionsStep();
  }


  /* ══════════════════════════════════════════
     OPTIONS STEP RENDERING
     ══════════════════════════════════════════ */
  function renderOptionsStep() {
    const container = document.getElementById('story-preview-options');
    if (!container) return;

    if (optionStep < currentStoryOptions.length) {
      const group = currentStoryOptions[optionStep];
      const apiTag = group._fromApi
        ? ' <span class="source-tag source-api" style="font-size:0.65rem;vertical-align:middle;display:inline;padding:0.1rem 0.4rem;"><i class="fas fa-cloud"></i> API</span>'
        : '';

      let html = '';
      html += `<h4 class="options-step-title"><i class="${group.icon} me-2"></i>${group.option}${apiTag}</h4>`;
      html += `<div class="options-cards-row">`;
      group.values.forEach(val => {
        const disabledClass = val.disabled ? 'option-disabled' : '';
        const btnDisabled   = val.disabled ? 'disabled' : '';
        const btnLabel      = val.disabled
          ? '<i class="fas fa-lock me-1"></i>Locked'
          : '<i class="fas fa-check me-1"></i>Select';
        const subtitleHTML  = val.subtitle
          ? `<div class="option-subtitle">${val.subtitle}</div>`
          : '';
        const statsHTML     = val.stats
          ? `<div class="option-stats">${val.stats}</div>`
          : '';
        html += `
          <div class="option-card card-dimension-little ${disabledClass}" data-value="${val.label}">
            <div class="option-title-plate"><span>${val.label}</span></div>
            <div class="option-visual"><i class="${val.icon}"></i></div>
            ${subtitleHTML}
            ${statsHTML}
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

      /* Show API detail info if available */
      const storyId = pendingStoryId;
      const detail = storyDetails[storyId];
      if (detail) {
        html += renderApiDetailBadges(detail);
      }

      container.innerHTML = html;

      /* Bind selection buttons */
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
  }

  /**
   * Render API detail badges (author, locations, events, etc.)
   */
  function renderApiDetailBadges(detail) {
    /*
    let html = '<div class="api-detail-badges">';
    html += '<span class="api-detail-title"><i class="fas fa-cloud me-1"></i>From API:</span>';
    if (detail.author)               html += ` <span class="api-badge"><i class="fas fa-feather-alt me-1"></i>${detail.author}</span>`;
    if (detail.locationCount != null) html += ` <span class="api-badge"><i class="fas fa-map-marker-alt me-1"></i>${detail.locationCount} Locations</span>`;
    if (detail.eventCount != null)    html += ` <span class="api-badge"><i class="fas fa-bolt me-1"></i>${detail.eventCount} Events</span>`;
    if (detail.itemCount != null)     html += ` <span class="api-badge"><i class="fas fa-box me-1"></i>${detail.itemCount} Items</span>`;
    if (detail.classCount != null)    html += ` <span class="api-badge"><i class="fas fa-chess-rook me-1"></i>${detail.classCount} Classes</span>`;
    if (detail.traitCount != null)    html += ` <span class="api-badge"><i class="fas fa-star-half-alt me-1"></i>${detail.traitCount} Traits</span>`;
    if (detail.characterTemplateCount != null) html += ` <span class="api-badge"><i class="fas fa-users me-1"></i>${detail.characterTemplateCount} Templates</span>`;
    if (detail.copyrightText)         html += ` <span class="api-badge"><i class="fas fa-copyright me-1"></i>${detail.copyrightText}</span>`;
    html += '</div>';
    */
    const html="";
    return html;
  }

  /* ══════════════════════════════════════════
     LOGIN STEP
     ══════════════════════════════════════════ */
  function renderLoginStep() {
    const container = document.getElementById('story-preview-options');
    if (!container) return;
    let html = ``;

    html += `<h4 class="options-step-title"><i class="fas fa-user-circle me-2"></i>Login</h4>`;
    html += `<div class="options-cards-row">`;

    html += `
      <div class="option-card card-dimension-little" data-value="guest">
        <div class="option-title-plate"><span>Guest</span></div>
        <div class="option-visual"><i class="fas fa-user"></i></div>
        <button class="option-select-btn" id="btn-login-guest"><i class="fas fa-play me-1"></i>Guest</button>
      </div>`;

    html += `
      <div class="option-card card-dimension-little option-disabled" data-value="register">
        <div class="option-title-plate"><span>Register</span></div>
        <div class="option-visual"><i class="fas fa-user-plus"></i></div>
        <button class="option-select-btn" disabled><i class="fas fa-lock me-1"></i>Register</button>
      </div>`;

    html += `
      <div class="option-card card-dimension-little option-disabled" data-value="login">
        <div class="option-title-plate"><span>Login</span></div>
        <div class="option-visual"><i class="fas fa-sign-in-alt"></i></div>
        <button class="option-select-btn" disabled><i class="fas fa-lock me-1"></i>Login</button>
      </div>`;

    html += `</div>`;

    html += `<div class="options-summary">`;
    for (const [key, value] of Object.entries(selectedOptions)) {
      html += `<span class="option-summary-badge"><i class="fas fa-check-circle me-1"></i>${key}: ${value}</span>`;
    }
    html += `</div>`;

    /* API detail badges */
    const detail = storyDetails[pendingStoryId];
    if (detail) html += renderApiDetailBadges(detail);

    container.innerHTML = html;

    container.querySelector('#btn-login-guest')?.addEventListener('click', e => {
      e.stopPropagation();
      selectedOptions['Login'] = 'Guest';
      renderFinalOptions();
    });
  }


  /* ══════════════════════════════════════════
     FINAL OPTIONS (Ready to Play)
     ══════════════════════════════════════════ */
  function renderFinalOptions() {
    const container = document.getElementById('story-preview-options');
    if (!container) return;

    let summaryHTML = `<div class="options-summary">`;
    for (const [key, value] of Object.entries(selectedOptions)) {
      summaryHTML += `<span class="option-summary-badge"><i class="fas fa-check-circle me-1"></i>${key}: ${value}</span>`;
    }
    summaryHTML += `</div>`;

    const checkVisual   = termsAccepted
      ? `<i class="fas fa-check-square"></i>`
      : `<span class="option-terms-notice">To play you must read and accept 
          <button class="option-terms-info" id="btn-terms-info" title="Read Terms"> the terms of conditions</button>
        </span>`;
    const startDisabled = termsAccepted ? '' : 'disabled';
    const startOpacity  = termsAccepted ? '' : 'option-btn-disabled';
    const startCardOpacity = termsAccepted ? '' : 'option-disabled';
    const termsCardOpacity = termsAccepted ? 'option-disabled' : '';

    let html = ``;
    html += `<h4 class="options-step-title"><i class="fas fa-play me-2"></i>Ready to Play</h4>`;
    html += `<div class="options-cards-row">`;

    html += `
      <div class="option-card card-dimension-little final-card ${termsCardOpacity}">
        <div class="option-title-plate"><span>Terms</span></div>
        <div class="option-visual">${checkVisual}</div>
        <button class="option-select-btn" id="btn-accept-terms"><i class="fas fa-check me-1"></i>${termsAccepted ? 'Accepted' : 'Accept'}</button>
      </div>`;

    html += `
      <div class="option-card card-dimension-little final-card ${startCardOpacity}">
        <div class="option-title-plate"><span>Start</span></div>
        <div class="option-visual"><i class="fas fa-dice-d20"></i></div>
        <button class="option-select-btn ${startOpacity}" id="btn-start-adventure" ${startDisabled}><i class="fas fa-play me-1"></i>Start</button>
      </div>`;

    html += `</div>`;
    html += summaryHTML;

    /* API detail badges */
    const detail = storyDetails[pendingStoryId];
    if (detail) html += renderApiDetailBadges(detail);

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
  }

  /* Modal Play button (hidden in options flow, kept for compat) */
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
    const story = stories.find(s => s.id === storyId);
    if (!story) return;

    /* Resolve local location data */
    const local = getLocalConfig(story);
    const localId = local.localId || story.id;
    const locMap = STORIES_LOCATIONS[localId];

    if (!locMap) {
      showPopup('✦ No location data available for this story ✦');
      return;
    }

    /* If no startLocation defined, pick a random one */
    if (!story.startLocation) {
      const locationKeys = Object.keys(locMap);
      story.startLocation = locationKeys[Math.floor(Math.random() * locationKeys.length)];
      console.log(`[Game] No startLocation — randomly selected: ${story.startLocation}`);
    }

    activeStory = { ...story, _localId: localId };
    currentId   = story.startLocation;
    navHistory  = [];

    /* Switch UI */
    elCatalog.style.display   = 'none';
    elWorld.style.display     = '';
    elGameBar.style.display   = '';
    elCrowdfund.style.display = 'none';
    elBarTitle.textContent    = story.title;

    /* Hide API config bar during game */
    const configBar = document.getElementById('api-config-bar');
    if (configBar) configBar.style.display = 'none';

    renderLocation(currentId);
  }

  function stopStory() {
    activeStory = null;
    currentId   = null;
    navHistory  = [];

    Array.from(elWorld.children).forEach(c => { if (c.id !== 'player-bar') c.remove(); });
    elWorld.style.display     = 'none';
    elCrowdfund.style.display = '';
    elGameBar.style.display   = 'none';
    elCatalog.style.display   = '';

    const configBar = document.getElementById('api-config-bar');
    if (configBar) configBar.style.display = '';
  }


  /* ══════════════════════════════════════════
     RENDER — single location
     ══════════════════════════════════════════ */
  function renderLocation(id, direction) {
    if (!activeStory) return;
    const localId = activeStory._localId || activeStory.id;
    const locMap = STORIES_LOCATIONS[localId] || {};
    const loc    = locMap[id];
    if (!loc) return;
    currentId = id;

    /* Active location card (left panel) */
    const visualHTML = loc.image
      ? `<img src="${loc.image}" alt="${loc.title}" class="card-visual-img" />`
      : `<span class="card-visual-emote">${loc.emote}</span>`;

    const locationCardHTML = `
      <div class="location-card card-dimension-large">
        <div class="card-title-plate">
          <span>${loc.title}</span>
          <i class="${loc.icon} card-plate-icon"${ loc.iconColor ? ` style="color:${loc.iconColor}"` : ''}></i>
        </div>
        <div class="card-body-left">
          <div class="card-visual">${visualHTML}</div>
          <div class="card-desc-area"><p>${loc.desc}</p><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
        </div>
        <div class="card-magic-footer"><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
      </div>`;

    /* Neighbor cards — Row 1 */
    const goCardsHTML = (loc.neighbors || []).map(nid => {
      const n = locMap[nid];
      if (!n) return '';
      return `
        <div class="choice-card card-dimension-normal go-card" data-target="${n.id}">
          <div class="choice-title-plate">
            <span>${n.title}</span>
            <i class="${n.icon} choice-plate-icon"${ n.iconColor ? ` style="color:${n.iconColor}"` : ''}></i>
          </div>
          <div class="choice-body-left">
            <div class="choice-visual"><span class="choice-visual-emote">${n.emote}</span></div>
            <div class="choice-desc-area"><p>${n.desc}</p></div>
          </div>
          <div class="choice-magic-footer"><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
        </div>`;
    }).join('');

    /* Action cards — Row 2 */
    const actionCardsHTML = (loc.actions || []).map(a => `
      <div class="choice-card card-dimension-normal action-card" data-action="${a.id}">
        <div class="choice-title-plate">
          <span>${a.title}</span>
          <i class="${a.icon} choice-plate-icon"></i>
        </div>
        <div class="choice-body-left">
          <div class="choice-visual"><span class="choice-visual-emote">${a.emote}</span></div>
          <div class="choice-desc-area"><p>${a.desc}</p></div>
        </div>
        <div class="choice-magic-footer"><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
      </div>`).join('');

    /* Build full scene */
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
      const old      = container.children[0];
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
     BIND GAME EVENTS after each render
     ══════════════════════════════════════════ */
  function bindGameEvents() {
    document.querySelectorAll('.go-card[data-target]').forEach(card => {
      card.addEventListener('click', () => {
        const localId = activeStory?._localId || activeStory?.id;
        const locMap = STORIES_LOCATIONS[localId] || {};
        const n = locMap[card.dataset.target];
        if (!n) return;
        showCardModal(n, 'go', card.dataset.target);
      });
    });

    document.querySelectorAll('.action-card[data-action]').forEach(card => {
      card.addEventListener('click', () => {
        const localId = activeStory?._localId || activeStory?.id;
        const locMap = STORIES_LOCATIONS[localId] || {};
        const loc    = locMap[currentId];
        const action = (loc?.actions || []).find(a => a.id === card.dataset.action);
        if (!action) return;
        showCardModal(action, 'action', card.dataset.action);
      });
    });

    document.querySelectorAll('.game-row-scroll').forEach(row => {
      let isDown = false, startX, scrollLeft;
      row.addEventListener('mousedown', e => { isDown = true; row.classList.add('grabbing'); startX = e.pageX - row.offsetLeft; scrollLeft = row.scrollLeft; });
      row.addEventListener('mouseleave', () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mouseup',    () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mousemove',  e => { if (!isDown) return; e.preventDefault(); row.scrollLeft = scrollLeft - (e.pageX - row.offsetLeft - startX) * 1.5; });
    });

    initCardTilt();
    initEntrance();
  }


  /* ══════════════════════════════════════════
     CARD DETAIL MODAL
     ══════════════════════════════════════════ */
  function showCardModal(data, type, id) {
    const isGo   = type === 'go';
    const visual = data.image
      ? `<img src="${data.image}" alt="${data.title}" style="width:100%;height:100%;object-fit:cover;" />`
      : `<span class="card-visual-emote">${data.emote}</span>`;
    const confirmLabel = isGo
      ? '<i class="fas fa-shoe-prints me-2"></i>Move'
      : '<i class="fas fa-scroll me-2"></i>Proceed';
    const iconAttr = data.icon
      ? `<i class="${data.icon} card-plate-icon"${ data.iconColor ? ` style="color:${data.iconColor}"` : ''}></i>`
      : '';

    document.getElementById('card-detail-inner').innerHTML = `
      <div class="card-detail-wrapper">
        <button class="card-detail-close" data-bs-dismiss="modal" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
        <div class="card-detail-card card-dimension-large">
          <div class="card-title-plate">
            <span>${data.title}</span>${iconAttr}
          </div>
          <div class="card-body-left">
            <div class="card-visual">${visual}</div>
            <div class="card-desc-area"><p>${data.desc}</p></div>
          </div>
          <div class="card-detail-footer">
            <button class="story-preview-play-btn" id="btn-card-confirm">${confirmLabel}</button>
            <button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button>
          </div>
          <div class="card-magic-footer"><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
        </div>
      </div>`;

    document.getElementById('btn-card-confirm').addEventListener('click', () => {
      bootstrap.Modal.getInstance(document.getElementById('cardDetailModal'))?.hide();
      if (isGo) {
        navigateTo(id);
      } else {
        showPopup(`✦ ${data.title}: coming soon… ✦`);
      }
    });

    new bootstrap.Modal(document.getElementById('cardDetailModal')).show();
  }


  /* ══════════════════════════════════════════
     GAME BAR EVENTS
     ══════════════════════════════════════════ */
  btnMap?.addEventListener('click', () => {
    showPopup('✦ The map is not yet available… ✦');
  });

  btnJournal?.addEventListener('click', () => {
    showPopup('✦ The journal is not yet available… ✦');
  });

  document.getElementById('btn-inventory')?.addEventListener('click', () => {
    showPopup('✦ The inventory is not yet available… ✦');
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.card-info-btn');
    if (btn) {
      e.stopPropagation();
      new bootstrap.Modal(document.getElementById('infoModal')).show();
    }
  });

  document.querySelector('.navbar-brand')?.addEventListener('click', e => {
    if (activeStory) {
      e.preventDefault();
      stopStory();
    }
  });


  /* ══════════════════════════════════════════
     CARD 3D TILT
     ══════════════════════════════════════════ */
  function initCardTilt() {
    document.querySelectorAll('.location-card, .go-card, .action-card').forEach(card => {
      const isSmall = card.classList.contains('go-card') || card.classList.contains('action-card');
      card.addEventListener('mousemove', e => {
        const r  = card.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
        const dy = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
        const tz = isSmall ? 4 : 8;
        card.style.transform =
          `perspective(900px) rotateX(${-dy * 8}deg) rotateY(${dx * 8}deg) translateY(-${tz}px) scale(1.04)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }


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
     USER BUTTON (placeholder)
     ══════════════════════════════════════════ */
  document.getElementById('btn-user')?.addEventListener('click', () => {
    showPopup('✦ Login is not yet available — continuing as guest ✦');
  });


  /* ══════════════════════════════════════════
     API CONFIG BAR
     ══════════════════════════════════════════ */
  document.getElementById('btn-toggle-config')?.addEventListener('click', () => {
    const fields = document.getElementById('api-config-fields');
    if (fields) fields.style.display = fields.style.display === 'none' ? 'flex' : 'none';
  });

  document.getElementById('btn-reload-api')?.addEventListener('click', () => {
    storyDetails = {};
    loadStories();
  });


  /* ══════════════════════════════════════════
     INIT
     ══════════════════════════════════════════ */
  loadStories();

})();

/* =============================================
   PATHS GAME — main.js  (v0.16.1-stories-cards)
   =============================================
   Stories & Cards from the real API with
   automatic fallback to mock-data.js.
   Server selector (local / AWS) + status dot.
   ============================================= */
(function () {
  'use strict';

  /* ══════════════════════════════════════════
     SERVER CONFIGURATION
     ══════════════════════════════════════════ */
  const SERVERS = {
    'local': { label: 'Local', url: 'http://localhost:8042' },
    'aws':          { label: 'Remote',   url: 'https://<REMOTE_API>.execute-api.us-east-2.amazonaws.com/dev' }
  };
  const DEFAULT_LANG = 'en';

  /* ══════════════════════════════════════════
     APPLICATION STATE
     ══════════════════════════════════════════ */
  let currentServer = 'local';
  let serverOnline  = null;       // null = unknown, true/false
  let usingMock     = false;
  let stories       = [];         // StorySummary[]
  let selectedStory = null;       // UUID of currently expanded story
  let storyDetail   = null;       // StoryDetail
  let cardDetail    = null;       // CardInfo from /api/content/
  let healthCheckTimer = null;

  /* ══════════════════════════════════════════
     DOM HELPERS
     ══════════════════════════════════════════ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function baseUrl() {
    return SERVERS[currentServer]?.url || SERVERS['local-python'].url;
  }

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
    setStatus(null);
    try {
      const resp = await fetch(baseUrl() + '/api/stories?lang=' + DEFAULT_LANG, {
        signal: AbortSignal.timeout(4000)
      });
      if (resp.ok) {
        setStatus(true);
        return true;
      }
      setStatus(false);
      return false;
    } catch {
      setStatus(false);
      return false;
    }
  }

  function startHealthPoll() {
    if (healthCheckTimer) clearInterval(healthCheckTimer);
    healthCheckTimer = setInterval(async () => {
      if (!usingMock) return;           // already using API, skip
      const ok = await healthCheck();
      if (ok && usingMock) {
        // Server came back online — reload
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
    const url = baseUrl() + path;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
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
     LOAD STORIES (API ➜ fallback mock)
     ══════════════════════════════════════════ */
  async function loadStories() {
    const catalog = $('#story-catalog');
    catalog.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> Loading stories…</div>';

    try {
      stories = await fetchStories();
      usingMock = false;
      setStatus(true);
    } catch {
      stories = typeof MOCK_STORIES !== 'undefined' ? MOCK_STORIES : [];
      usingMock = true;
      setStatus(false);
    }

    renderCatalog();
    startHealthPoll();
  }

  /* ══════════════════════════════════════════
     RENDER CATALOG
     ══════════════════════════════════════════ */
  function renderCatalog() {
    const catalog = $('#story-catalog');
    if (!stories.length) {
      catalog.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> No stories available.</div>';
      return;
    }

    // Group by category
    const groups = {};
    stories.forEach(s => {
      const cat = (s.category || 'other').charAt(0).toUpperCase() + (s.category || 'other').slice(1);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });

    let html = '';
    for (const [cat, list] of Object.entries(groups)) {
      html += `<div class="catalog-category">
        <h3 class="catalog-cat-title">${escapeHtml(cat)}</h3>
        <div class="catalog-row">`;
      list.forEach(s => {
        html += renderStoryCard(s);
      });
      html += '</div></div>';
    }

    catalog.innerHTML = html;

    // Initialize drag-scroll on rows
    catalog.querySelectorAll('.catalog-row').forEach(initDragScroll);

    // Add 3D effect to new cards
    if (typeof add3dEffect === 'function') add3dEffect();
  }

  function renderStoryCard(story) {
    const icon = getCategoryIcon(story.category);
    console.log(story);
    const imageUrl = story.imageUrl ? `background-image:url('${escapeHtml(story.card.imageUrl)}');` : '';
    return `
      <div class="catalog-card card-3d card-dimension-normal"
           data-story-uuid="${escapeHtml(story.uuid)}"
           onclick="window._selectStory('${escapeHtml(story.uuid)}')">
        <div class="catalog-card-cover" style="background-image:${imageUrl};background-size:cover;background-position:center;">
          
        </div>
        <div class="catalog-title-plate">
          <span>${escapeHtml(story.title || 'Untitled')}</span>
        </div>
        <div class="catalog-play-btn">
          <i class="fas fa-eye"></i> Details
        </div>

      </div>`;
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
     SELECT STORY — show detail modal
     ══════════════════════════════════════════ */
  window._selectStory = async function (uuid) {
    selectedStory = uuid;

    const modalEl = $('#storyDetailModal');
    const modal = new bootstrap.Modal(modalEl);
    
    // Show loading state
    $('#storyDetailLabel').textContent = 'Loading…';
    $('#story-detail-header').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> Fetching story…</div>';
    ['#event-card-container', '#difficulties-container', '#classes-container', '#traits-container'].forEach(sel => {
      $(sel).innerHTML = '';
    });

    modal.show();

    // Step 1: get story detail (contains card UUID)
    try {
      if (usingMock) {
        storyDetail = (typeof MOCK_STORY_DETAILS !== 'undefined') ? MOCK_STORY_DETAILS[uuid] : null;
        if (!storyDetail) throw new Error('No mock detail for ' + uuid);
      } else {
        storyDetail = await fetchStoryDetail(uuid);
      }
    } catch (err) {
      // Fallback to mock
      storyDetail = (typeof MOCK_STORY_DETAILS !== 'undefined') ? MOCK_STORY_DETAILS[uuid] : null;
      if (!storyDetail) {
        renderDetailError('Story not found: ' + uuid);
        return;
      }
    }

    // Step 2: fetch card via /api/content/{storyUuid}/cards/{cardUuid}
    cardDetail = null;
    if (storyDetail.card && storyDetail.card.uuid) {
      try {
        if (usingMock) {
          cardDetail = (typeof MOCK_CARD_DETAILS !== 'undefined') ? MOCK_CARD_DETAILS[storyDetail.card.uuid] : null;
        } else {
          cardDetail = await fetchCardDetail(uuid, storyDetail.card.uuid);
        }
      } catch {
        // Fallback to card from storyDetail directly
        cardDetail = storyDetail.card || null;
      }
    }

    renderStoryDetailModal();
  };

  window._closeDetail = function () {
    closeDetailModal();
  };

  function closeDetailModal() {
    selectedStory = null;
    storyDetail = null;
    cardDetail = null;
    const modalEl = $('#storyDetailModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }

  function renderDetailError(msg) {
    $('#storyDetailLabel').textContent = 'Error';
    $('#story-detail-header').innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(msg) + '</div>';
  }

  /* ══════════════════════════════════════════
     RENDER STORY DETAIL MODAL
     ══════════════════════════════════════════ */
  function renderStoryDetailModal() {
    const s = storyDetail;
    const c = cardDetail;

    // Update modal title
    $('#storyDetailLabel').textContent = escapeHtml(s.title || 'Story Detail');

    // ── Story meta & event card header ──
    let headerHtml = `
      <div style="display:flex;gap:2rem;align-items:flex-start;margin-bottom:1rem;">
        <div style="flex:1;">
          <h3 style="font-family:var(--font-heading);color:var(--color-gold-light);font-size:1.5rem;margin-bottom:0.5rem;">
            ${escapeHtml(s.title || 'Untitled')}
          </h3>
          <p style="font-family:var(--font-body);color:var(--color-parchment-light);margin-bottom:0.8rem;font-size:1.1rem;">
            ${escapeHtml(s.description || '')}
          </p>
          <div class="story-meta-badges">
            ${s.author ? '<span class="story-meta-badge"><i class="fas fa-user-edit"></i>' + escapeHtml(s.author) + '</span>' : ''}
            ${s.category ? '<span class="story-meta-badge"><i class="fas fa-tag"></i>' + escapeHtml(s.category) + '</span>' : ''}
            ${s.group ? '<span class="story-meta-badge"><i class="fas fa-layer-group"></i>' + escapeHtml(s.group) + '</span>' : ''}
            ${s.peghi ? '<span class="story-meta-badge"><i class="fas fa-gem" style="color:var(--color-gold)"></i> ' + s.peghi + '</span>' : ''}
            ${s.locationCount ? '<span class="story-meta-badge"><i class="fas fa-map-marker-alt"></i> ' + s.locationCount + ' Location' + (s.locationCount !== 1 ? 's' : '') + '</span>' : ''}
            ${s.eventCount ? '<span class="story-meta-badge"><i class="fas fa-bolt"></i> ' + s.eventCount + ' Event' + (s.eventCount !== 1 ? 's' : '') + '</span>' : ''}
            ${s.itemCount ? '<span class="story-meta-badge"><i class="fas fa-box-open"></i> ' + s.itemCount + ' Item' + (s.itemCount !== 1 ? 's' : '') + '</span>' : ''}
          </div>
        </div>
        ${c ? renderCardInfoCard(c, true) : ''}
      </div>`;
    $('#story-detail-header').innerHTML = headerHtml;

    // ── Event card (main card from the story) ──
    if (c) {
      $('#event-card-container').innerHTML = `
        <div style="margin-bottom:1rem;">
          <h4 style="font-family:var(--font-heading);color:var(--color-gold-light);font-size:1rem;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.5rem;border-left:2px solid var(--color-gold-dark);padding-left:0.5rem;">
            <i class="fas fa-id-card"></i> Event Card
          </h4>
          <div class="card-3d">${renderCardInfoCard(c, false)}</div>
        </div>`;
    }

    // ── Difficulties ──
    if (s.difficulties && s.difficulties.length) {
      let diffHtml = `<h4 style="font-family:var(--font-heading);color:var(--color-gold-light);font-size:1rem;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.8rem;border-left:2px solid var(--color-gold-dark);padding-left:0.5rem;grid-column:1/-1;">
        <i class="fas fa-dumbbell"></i> Difficulties (${s.difficulties.length})
      </h4>`;
      s.difficulties.forEach(d => {
        diffHtml += `<div class="catalog-card card-3d card-dimension-normal" style="cursor:default;">
          <div class="catalog-card-cover" style="background:linear-gradient(135deg,var(--color-brown-mid),var(--color-brown-warm));">
            <i class="fas fa-dumbbell catalog-card-icon"></i>
          </div>
          <div class="catalog-title-plate">
            <span>${escapeHtml(d.name || '—')}</span>
          </div>
          <div class="catalog-play-btn" style="margin:0.5rem;text-align:left;padding:0.3rem 0.5rem;font-size:0.7rem;white-space:normal;cursor:default;">
            <small>${escapeHtml(d.description || '')} ${d.priority ? ' • Pri ' + d.priority : ''}</small>
          </div>
        </div>`;
      });
      $('#difficulties-container').innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0.8rem;padding:1rem;background:rgba(0,0,0,0.2);border-radius:8px;border:1px solid rgba(200,150,10,0.1);grid-column:2/4;">
          ${diffHtml}
        </div>`;
    }

    // ── Classes ──
    if (s.classes && s.classes.length) {
      let classHtml = `<h4 style="font-family:var(--font-heading);color:var(--color-gold-light);font-size:1rem;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.8rem;border-left:2px solid var(--color-gold-dark);padding-left:0.5rem;">
        <i class="fas fa-users"></i> Classes (${s.classes.length})
      </h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;">`;
      s.classes.forEach(cl => {
        classHtml += `<div class="catalog-card card-3d card-dimension-normal" style="cursor:default;">
          <div class="catalog-card-cover" style="background:linear-gradient(135deg,var(--color-brown-tan),var(--color-brown-warm));">
            <i class="fas fa-shield-alt catalog-card-icon"></i>
          </div>
          <div class="catalog-title-plate">
            <span>${escapeHtml(cl.name || '—')}</span>
          </div>
          <div class="catalog-play-btn" style="margin:0.5rem;text-align:left;padding:0.3rem 0.5rem;font-size:0.7rem;cursor:default;">
            <small>${escapeHtml(cl.description || '')}</small>
          </div>
        </div>`;
      });
      classHtml += '</div>';
      $('#classes-container').innerHTML = classHtml;
    }

    // ── Traits ──
    if (s.traits && s.traits.length) {
      let traitHtml = `<h4 style="font-family:var(--font-heading);color:var(--color-gold-light);font-size:1rem;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.8rem;border-left:2px solid var(--color-gold-dark);padding-left:0.5rem;">
        <i class="fas fa-sparkles"></i> Traits (${s.traits.length})
      </h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;">`;
      s.traits.forEach(t => {
        traitHtml += `<div class="catalog-card card-3d card-dimension-normal" style="cursor:default;">
          <div class="catalog-card-cover" style="background:linear-gradient(135deg,var(--color-ember),var(--color-brown-tan));">
            <i class="fas fa-star catalog-card-icon"></i>
          </div>
          <div class="catalog-title-plate">
            <span>${escapeHtml(t.name || '—')}</span>
          </div>
          <div class="catalog-play-btn" style="margin:0.5rem;text-align:left;padding:0.3rem 0.5rem;font-size:0.7rem;cursor:default;">
            <small>${escapeHtml(t.description || '')}</small>
          </div>
        </div>`;
      });
      traitHtml += '</div>';
      $('#traits-container').innerHTML = traitHtml;
    }

    // ── JSON raw ──
    let jsonHtml = `<strong style="color:var(--color-gold);display:block;margin-bottom:0.5rem;">Story Detail (GET /api/stories/${escapeHtml(s.uuid)})</strong>\n`;
    jsonHtml += escapeHtml(JSON.stringify(s, null, 2));
    if (c) {
      jsonHtml += `\n\n<strong style="color:var(--color-gold);display:block;margin-top:1rem;margin-bottom:0.5rem;">Card Info (GET /api/content/${escapeHtml(s.uuid)}/cards/${escapeHtml(c.uuid)})</strong>\n`;
      jsonHtml += escapeHtml(JSON.stringify(c, null, 2));
    }
    $('#story-json-raw').innerHTML = jsonHtml;

    // Add 3D effects to new cards
    if (typeof add3dEffect === 'function') add3dEffect();
  }

  function renderCardInfoCard(c, isHeaderCompact) {
    let visual = '';
    if (c.imageUrl) {
      visual = `<img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(c.title || 'Card')}" onerror="this.style.display='none'" />`;
    } else if (c.awesomeIcon) {
      visual = `<i class="${escapeHtml(c.awesomeIcon)} card-info-icon"></i>`;
    } else {
      visual = '<i class="fas fa-id-card card-info-icon"></i>';
    }

    let creatorHtml = '';
    if (c.creator) {
      creatorHtml = '<div class="creator-badge">';
      if (c.creator.urlImage) {
        creatorHtml += `<img src="${escapeHtml(c.creator.urlImage)}" alt="" onerror="this.style.display='none'" />`;
      } else {
        creatorHtml += '<i class="fas fa-user-circle" style="color:var(--color-gold)"></i>';
      }
      const name = escapeHtml(c.creator.name || 'Unknown');
      if (c.creator.link) {
        creatorHtml += `<a href="${escapeHtml(c.creator.link)}" target="_blank" rel="noopener">${name}</a>`;
      } else {
        creatorHtml += `<span>${name}</span>`;
      }
      creatorHtml += '</div>';
    }

    let copyrightHtml = '';
    if (c.copyrightText) {
      copyrightHtml = `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;">
        <i class="fas fa-copyright"></i>
        ${c.linkCopyright ? '<a href="' + escapeHtml(c.linkCopyright) + '" target="_blank">' + escapeHtml(c.copyrightText) + '</a>' : escapeHtml(c.copyrightText)}
      </div>`;
    }

    if (isHeaderCompact) {
      // Small card version for header
      return `
        <div class="card-info-card card-3d" style="width:220px;min-width:220px;">
          <div class="card-info-visual" style="min-height:140px;">${visual}</div>
          <div class="card-info-title-plate">
            <span style="font-size:0.95rem;">${escapeHtml(c.title || '—')}</span>
          </div>
          <div class="card-info-desc-area">
            <p style="font-size:0.85rem;line-height:1.4;">${escapeHtml(c.description || '')}</p>
          </div>
          <div class="card-info-footer">
            ${creatorHtml}
            ${copyrightHtml}
          </div>
        </div>`;
    }

    // Full-size card version
    return `
      <div class="card-info-card card-3d card-dimension-detail">
        <div class="card-info-visual">${visual}</div>
        <div class="card-info-title-plate">
          <span>${escapeHtml(c.title || '—')}</span>
          ${c.awesomeIcon ? '<i class="' + escapeHtml(c.awesomeIcon) + ' card-plate-icon"></i>' : ''}
        </div>
        <div class="card-info-desc-area">
          <p>${escapeHtml(c.description || '')}</p>
        </div>
        <div class="card-info-footer">
          ${creatorHtml}
          ${copyrightHtml}
          <div style="margin-top:0.3rem;font-size:0.65rem;color:var(--text-muted);">
            <i class="fas fa-fingerprint"></i> ${escapeHtml(c.uuid || '')}
            ${c.styleMain ? ' &middot; <i class="fas fa-palette"></i> ' + escapeHtml(c.styleMain) : ''}
          </div>
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════
     JSON TOGGLE
     ══════════════════════════════════════════ */
  window._toggleStoryJson = function () {
    const p = $('#story-json-raw');
    if (p) {
      if (p.style.display === 'none') {
        p.style.display = 'block';
      } else {
        p.style.display = 'none';
      }
    }
  };

  /* ══════════════════════════════════════════
     DRAG-SCROLL (catalog rows)
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
    row.addEventListener('mouseup', () => { isDown = false; row.classList.remove('grabbing'); });
    row.addEventListener('mousemove', e => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - row.offsetLeft;
      row.scrollLeft = scrollLeft - (x - startX) * 1.5;
    });
  }

  /* ══════════════════════════════════════════
     SERVER SELECTOR
     ══════════════════════════════════════════ */
  function initServerSelector() {
    const sel = $('#server-select');
    if (!sel) return;

    // Populate options
    for (const [key, cfg] of Object.entries(SERVERS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = cfg.label;
      if (key === currentServer) opt.selected = true;
      sel.appendChild(opt);
    }

    sel.addEventListener('change', async () => {
      currentServer = sel.value;
      selectedStory = null;
      closeDetailPanel();
      await loadStories();
    });
  }

  /* ══════════════════════════════════════════
     HERO BANNER
     ══════════════════════════════════════════ */
  function renderHero() {
    const img = typeof HERO_IMAGE !== 'undefined' ? HERO_IMAGE : null;
    const heroImg = $('#hero-img');
    if (heroImg && img) {
      heroImg.src = img.url;
      heroImg.alt = 'Paths Games — photo by ' + (img.artist || 'Unknown');
    }
  }

  /* ══════════════════════════════════════════
     INIT
     ══════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', async () => {
    renderHero();
    initServerSelector();
    await loadStories();
  });

})();

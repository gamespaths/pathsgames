/* =============================================
   PATHS GAMES — stories.js (v0.14.0)
   Story catalog browser — Step 14 concept

   Public endpoints (no auth required):
   - GET /api/stories?lang=en        → list published stories
   - GET /api/stories/{uuid}?lang=en → story detail with difficulties
   ============================================= */

(function () {
  'use strict';

  /* ══════════════════════════════════════════
     CONFIGURATION
     ══════════════════════════════════════════ */
  const API_BASE = 'http://localhost:8042';
  const ENDPOINTS = {
    echoStatus: API_BASE + '/api/echo/status',
    stories:    API_BASE + '/api/stories'
  };

  /* ══════════════════════════════════════════
     STATE
     ══════════════════════════════════════════ */
  let currentLang = 'en';

  /* ══════════════════════════════════════════
     DOM
     ══════════════════════════════════════════ */
  const statusDot        = document.getElementById('statusDot');
  const statusText       = document.getElementById('statusText');
  const langSelect       = document.getElementById('langSelect');
  const storiesContainer = document.getElementById('storiesContainer');
  const storyCount       = document.getElementById('storyCount');
  const modalOverlay     = document.getElementById('modalOverlay');
  const modalTitle       = document.getElementById('modalTitle');
  const modalBody        = document.getElementById('modalBody');

  /* ══════════════════════════════════════════
     EXPOSE TO HTML onclick
     ══════════════════════════════════════════ */
  window.changeLang   = changeLang;
  window.viewStory    = viewStory;
  window.closeModal   = closeModal;

  /* ══════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════ */
  (function init() {
    checkServerStatus();
    loadStories();
  })();

  /* ══════════════════════════════════════════
     SERVER STATUS
     ══════════════════════════════════════════ */
  async function checkServerStatus() {
    try {
      const res = await fetch(ENDPOINTS.echoStatus);
      if (res.ok) {
        const data = await res.json();
        const ver = data.properties?.version || '?';
        statusDot.classList.add('online');
        statusText.textContent = 'v' + ver;
      } else {
        throw new Error('HTTP ' + res.status);
      }
    } catch (e) {
      statusDot.classList.remove('online');
      statusText.textContent = 'Offline';
    }
  }

  /* ══════════════════════════════════════════
     LANGUAGE CHANGE
     ══════════════════════════════════════════ */
  function changeLang() {
    currentLang = langSelect.value;
    loadStories();
  }

  /* ══════════════════════════════════════════
     LOAD STORIES — GET /api/stories?lang=
     ══════════════════════════════════════════ */
  async function loadStories() {
    storiesContainer.innerHTML =
      '<div class="loading-state">' +
      '<i class="fas fa-spinner fa-spin"></i>' +
      '<p>Loading stories…</p></div>';

    try {
      const res = await fetch(ENDPOINTS.stories + '?lang=' + currentLang);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const stories = await res.json();
      renderStories(stories);
    } catch (e) {
      storiesContainer.innerHTML =
        '<div class="error-state">' +
        '<i class="fas fa-exclamation-triangle"></i>' +
        '<p>Could not load stories</p>' +
        '<p style="font-size:0.82rem;margin-top:0.5rem;">' + escapeHtml(e.message) + '</p>' +
        '</div>';
      storyCount.textContent = 'Error';
    }
  }

  /* ══════════════════════════════════════════
     RENDER STORY CARDS
     ══════════════════════════════════════════ */
  function renderStories(stories) {
    if (!stories || stories.length === 0) {
      storiesContainer.innerHTML =
        '<div class="empty-state">' +
        '<i class="fas fa-ghost"></i>' +
        '<p>No stories available</p>' +
        '<p style="font-size:0.82rem;margin-top:0.5rem;">Import stories via the admin panel to see them here.</p>' +
        '</div>';
      storyCount.textContent = '0 stories';
      return;
    }

    storyCount.textContent = stories.length + ' stor' + (stories.length === 1 ? 'y' : 'ies');

    const html = '<div class="stories-grid">' +
      stories.map(function (s) {
        var tags = '';
        if (s.category) tags += '<span class="tag tag-category">' + escapeHtml(s.category) + '</span>';
        if (s.group)    tags += '<span class="tag tag-group">' + escapeHtml(s.group) + '</span>';
        if (s.peghi)    tags += '<span class="tag tag-peghi">PEGHI ' + escapeHtml(String(s.peghi)) + '</span>';

        return (
          '<div class="story-card" onclick="viewStory(\'' + escapeHtml(s.uuid) + '\')">' +
            '<div class="story-card-header">' +
              '<div class="story-card-title">' + escapeHtml(s.title || 'Untitled') + '</div>' +
              (s.priority != null ? '<span class="story-card-priority"><i class="fas fa-star"></i> ' + s.priority + '</span>' : '') +
            '</div>' +
            (s.author ? '<div class="story-card-author"><i class="fas fa-feather-alt"></i> ' + escapeHtml(s.author) + '</div>' : '') +
            '<div class="story-card-desc">' + escapeHtml(s.description || 'No description available.') + '</div>' +
            '<div class="story-card-footer">' +
              '<div class="story-card-tags">' + tags + '</div>' +
              '<div class="story-card-difficulties">' +
                '<i class="fas fa-shield-alt"></i> ' + (s.difficultyCount || 0) + ' difficult' + (s.difficultyCount === 1 ? 'y' : 'ies') +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }).join('') +
    '</div>';

    storiesContainer.innerHTML = html;
  }

  /* ══════════════════════════════════════════
     VIEW STORY DETAIL — GET /api/stories/{uuid}
     ══════════════════════════════════════════ */
  async function viewStory(uuid) {
    modalTitle.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading…';
    modalBody.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading story details…</p></div>';
    modalOverlay.classList.add('visible');

    try {
      const res = await fetch(ENDPOINTS.stories + '/' + uuid + '?lang=' + currentLang);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Story not found');
        throw new Error('HTTP ' + res.status);
      }
      const story = await res.json();
      renderStoryDetail(story);
    } catch (e) {
      modalTitle.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
      modalBody.innerHTML =
        '<div class="error-state">' +
        '<i class="fas fa-exclamation-triangle"></i>' +
        '<p>' + escapeHtml(e.message) + '</p></div>';
    }
  }

  /* ══════════════════════════════════════════
     RENDER STORY DETAIL
     ══════════════════════════════════════════ */
  function renderStoryDetail(s) {
    modalTitle.innerHTML = '<i class="fas fa-book-open"></i> ' + escapeHtml(s.title || 'Untitled');

    var html = '';

    // ── description ──
    if (s.description) {
      html += '<div class="detail-desc">' + escapeHtml(s.description) + '</div>';
    }

    // ── main info ──
    html += '<div class="detail-section">';
    html += '<div class="detail-section-title"><i class="fas fa-info-circle"></i> Information</div>';
    html += '<div class="detail-grid">';
    html += detailItem('UUID', s.uuid, 'uuid');
    html += detailItem('Author', s.author);
    html += detailItem('Category', s.category);
    html += detailItem('Group', s.group);
    html += detailItem('Visibility', s.visibility);
    html += detailItem('Priority', s.priority);
    html += detailItem('PEGHI', s.peghi);
    html += detailItem('Copyright', s.copyright);
    html += '</div></div>';

    // ── version & clock ──
    html += '<div class="detail-section">';
    html += '<div class="detail-section-title"><i class="fas fa-cog"></i> Configuration</div>';
    html += '<div class="detail-grid">';
    html += detailItem('Version Min', s.versionMin);
    html += detailItem('Version Max', s.versionMax);
    html += detailItem('Clock Name', s.clockName);
    html += detailItem('Clock Description', s.clockDescription);
    html += '</div></div>';

    // ── entity counts ──
    html += '<div class="detail-section">';
    html += '<div class="detail-section-title"><i class="fas fa-database"></i> Content</div>';
    html += '<div class="entity-counts">';
    html += entityCount('fa-map-marker-alt', 'Locations', s.locationCount);
    html += entityCount('fa-calendar-alt', 'Events', s.eventCount);
    html += entityCount('fa-box-open', 'Items', s.itemCount);
    html += '</div></div>';

    // ── difficulties ──
    if (s.difficulties && s.difficulties.length > 0) {
      html += '<div class="detail-section">';
      html += '<div class="detail-section-title"><i class="fas fa-shield-alt"></i> Difficulties (' + s.difficulties.length + ')</div>';
      html += '<div class="difficulty-list">';
      s.difficulties.forEach(function (d) {
        html += '<div class="difficulty-card">';
        html += '<div class="difficulty-card-name">' + escapeHtml(d.name || 'Unnamed') + '</div>';
        if (d.description) {
          html += '<div class="difficulty-card-desc">' + escapeHtml(d.description) + '</div>';
        }
        html += '<div class="difficulty-stats">';
        html += statRow('XP Cost', d.expCost);
        html += statRow('Max Weight', d.maxWeight);
        html += statRow('Min Char.', d.minCharacter);
        html += statRow('Max Char.', d.maxCharacter);
        html += statRow('Help Cost', d.costHelpComa);
        html += statRow('Max Stats Cost', d.costMaxCharacteristics);
        html += statRow('Free Actions', d.numberMaxFreeAction);
        html += '</div></div>';
      });
      html += '</div></div>';
    } else {
      html += '<div class="detail-section">';
      html += '<div class="detail-section-title"><i class="fas fa-shield-alt"></i> Difficulties</div>';
      html += '<p style="font-size:0.82rem;color:var(--color-ash);">No difficulty levels defined.</p>';
      html += '</div>';
    }

    modalBody.innerHTML = html;
  }

  /* ══════════════════════════════════════════
     MODAL
     ══════════════════════════════════════════ */
  function closeModal(event) {
    if (event && event.target !== modalOverlay) return;
    modalOverlay.classList.remove('visible');
  }

  /* ══════════════════════════════════════════
     TEMPLATE HELPERS
     ══════════════════════════════════════════ */
  function detailItem(label, value, valueClass) {
    var cls = valueClass ? ' ' + valueClass : '';
    var display = (value != null && value !== '') ? escapeHtml(String(value)) : '—';
    return (
      '<div class="detail-item">' +
        '<div class="detail-label">' + escapeHtml(label) + '</div>' +
        '<div class="detail-value' + cls + '">' + display + '</div>' +
      '</div>'
    );
  }

  function entityCount(icon, label, count) {
    var n = (count != null) ? count : 0;
    return (
      '<div class="entity-count">' +
        '<i class="fas ' + icon + '"></i> ' +
        '<span>' + escapeHtml(label) + ':</span> ' +
        '<span class="count-value">' + n + '</span>' +
      '</div>'
    );
  }

  function statRow(label, value) {
    var v = (value != null) ? value : '—';
    return (
      '<span class="stat-label">' + escapeHtml(label) + '</span>' +
      '<span class="stat-value">' + v + '</span>'
    );
  }

  function escapeHtml(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

})();

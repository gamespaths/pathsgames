/* =============================================
   PATHS GAMES — v0.15.0 — main.js
   Story browser with category/group endpoints
   ============================================= */
(function () {
  'use strict';

  /* ══════ DOM refs ══════ */
  const elApiBase       = document.getElementById('api-base');
  const elLang          = document.getElementById('lang-select');
  const btnRefresh      = document.getElementById('btn-refresh');
  const elCategoryList  = document.getElementById('category-list');
  const elCategoryTitle = document.getElementById('category-stories-title');
  const elCategoryStories = document.getElementById('category-stories');
  const elGroupList     = document.getElementById('group-list');
  const elGroupTitle    = document.getElementById('group-stories-title');
  const elGroupStories  = document.getElementById('group-stories');
  const elAllStories    = document.getElementById('all-stories');
  const elModalTitle    = document.getElementById('modal-title');
  const elModalBody     = document.getElementById('modal-body');

  /* ══════ Helpers ══════ */
  function apiBase() { return elApiBase.value.replace(/\/+$/, ''); }
  function lang() { return elLang.value || 'en'; }

  async function apiFetch(path) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${apiBase()}${path}${sep}lang=${lang()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`API error: ${url}`, err);
      return null;
    }
  }

  /* ══════ Render story card (summary) ══════ */
  function storyCard(story) {
    const peghi = '&#9733;'.repeat(story.peghi || 0);
    return `
      <div class="col-sm-6 col-lg-4">
        <div class="card story-card" data-uuid="${story.uuid}">
          <div class="card-body">
            <h6 class="card-title">${esc(story.title || 'Untitled')}</h6>
            <p class="card-text text-muted small">${esc(story.description || '')}</p>
            <div class="d-flex justify-content-between align-items-center">
              <span class="badge bg-info">${esc(story.category || '—')}</span>
              <span class="badge bg-secondary">${esc(story.group || '—')}</span>
            </div>
            <div class="mt-2 small">
              <span class="text-warning">${peghi}</span>
              <span class="ms-2">Priority: ${story.priority ?? 0}</span>
              <span class="ms-2">Difficulties: ${story.difficultyCount ?? 0}</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ══════ Load categories ══════ */
  async function loadCategories() {
    const cats = await apiFetch('/stories/categories');
    if (!cats) { elCategoryList.innerHTML = '<p class="text-muted">Could not load categories</p>'; return; }
    if (cats.length === 0) { elCategoryList.innerHTML = '<p class="text-muted">No categories found</p>'; return; }
    elCategoryList.innerHTML = cats.map(c =>
      `<a href="#" class="list-group-item list-group-item-action category-item" data-category="${esc(c)}">${esc(c)}</a>`
    ).join('');
    elCategoryList.querySelectorAll('.category-item').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); loadStoriesByCategory(el.dataset.category); });
    });
  }

  async function loadStoriesByCategory(category) {
    elCategoryTitle.textContent = `Stories in "${category}"`;
    elCategoryList.querySelectorAll('.category-item').forEach(el =>
      el.classList.toggle('active', el.dataset.category === category));
    const stories = await apiFetch(`/stories/category/${encodeURIComponent(category)}`);
    if (!stories || stories.length === 0) {
      elCategoryStories.innerHTML = '<p class="text-muted">No stories in this category</p>';
      return;
    }
    elCategoryStories.innerHTML = stories.map(storyCard).join('');
    attachCardClicks(elCategoryStories);
  }

  /* ══════ Load groups ══════ */
  async function loadGroups() {
    const grps = await apiFetch('/stories/groups');
    if (!grps) { elGroupList.innerHTML = '<p class="text-muted">Could not load groups</p>'; return; }
    if (grps.length === 0) { elGroupList.innerHTML = '<p class="text-muted">No groups found</p>'; return; }
    elGroupList.innerHTML = grps.map(g =>
      `<a href="#" class="list-group-item list-group-item-action group-item" data-group="${esc(g)}">${esc(g)}</a>`
    ).join('');
    elGroupList.querySelectorAll('.group-item').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); loadStoriesByGroup(el.dataset.group); });
    });
  }

  async function loadStoriesByGroup(group) {
    elGroupTitle.textContent = `Stories in "${group}"`;
    elGroupList.querySelectorAll('.group-item').forEach(el =>
      el.classList.toggle('active', el.dataset.group === group));
    const stories = await apiFetch(`/stories/group/${encodeURIComponent(group)}`);
    if (!stories || stories.length === 0) {
      elGroupStories.innerHTML = '<p class="text-muted">No stories in this group</p>';
      return;
    }
    elGroupStories.innerHTML = stories.map(storyCard).join('');
    attachCardClicks(elGroupStories);
  }

  /* ══════ Load all stories ══════ */
  async function loadAllStories() {
    const stories = await apiFetch('/stories');
    if (!stories || stories.length === 0) {
      elAllStories.innerHTML = '<p class="text-muted">No public stories available</p>';
      return;
    }
    elAllStories.innerHTML = stories.map(storyCard).join('');
    attachCardClicks(elAllStories);
  }

  /* ══════ Story detail modal ══════ */
  function attachCardClicks(container) {
    container.querySelectorAll('.story-card').forEach(card => {
      card.addEventListener('click', () => openDetail(card.dataset.uuid));
    });
  }

  async function openDetail(uuid) {
    elModalTitle.textContent = 'Loading...';
    elModalBody.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    const modal = new bootstrap.Modal(document.getElementById('storyModal'));
    modal.show();

    const d = await apiFetch(`/stories/${uuid}`);
    if (!d) { elModalBody.innerHTML = '<p class="text-danger">Failed to load story detail</p>'; return; }

    elModalTitle.textContent = d.title || 'Untitled';
    elModalBody.innerHTML = renderDetail(d);
  }

  function renderDetail(d) {
    let html = '';

    /* Header */
    html += `<div class="row mb-3">
      <div class="col-md-8">
        <p>${esc(d.description || '')}</p>
        <table class="table table-sm table-dark table-bordered">
          <tr><th>Author</th><td>${esc(d.author || '—')}</td></tr>
          <tr><th>Category</th><td>${esc(d.category || '—')}</td></tr>
          <tr><th>Group</th><td>${esc(d.group || '—')}</td></tr>
          <tr><th>Version</th><td>${esc(d.versionMin || '?')} – ${esc(d.versionMax || '?')}</td></tr>
          <tr><th>Copyright</th><td>${d.linkCopyright ? `<a href="${esc(d.linkCopyright)}" class="text-info">${esc(d.copyrightText || d.linkCopyright)}</a>` : esc(d.copyrightText || '—')}</td></tr>
        </table>
      </div>
      <div class="col-md-4">
        <div class="stat-box">
          <div class="stat"><i class="fas fa-map-marker-alt"></i> ${d.locationCount ?? 0} Locations</div>
          <div class="stat"><i class="fas fa-bolt"></i> ${d.eventCount ?? 0} Events</div>
          <div class="stat"><i class="fas fa-box"></i> ${d.itemCount ?? 0} Items</div>
          <div class="stat"><i class="fas fa-users"></i> ${d.characterTemplateCount ?? 0} Templates</div>
          <div class="stat"><i class="fas fa-chess-rook"></i> ${d.classCount ?? 0} Classes</div>
          <div class="stat"><i class="fas fa-star-half-alt"></i> ${d.traitCount ?? 0} Traits</div>
        </div>
      </div>
    </div>`;

    /* Card info */
    if (d.card) {
      html += `<div class="detail-section">
        <h6><i class="fas fa-id-card me-1"></i>Story Card</h6>
        <div class="card-info-box">
          ${d.card.imageUrl ? `<img src="${esc(d.card.imageUrl)}" alt="${esc(d.card.alternativeImage || '')}" class="card-img-preview" />` : ''}
          <div>
            <strong>${esc(d.card.title || '—')}</strong>
            ${d.card.awesomeIcon ? `<br/><i class="fas ${esc(d.card.awesomeIcon)}"></i>` : ''}
            ${d.card.styleMain ? `<br/><span class="badge bg-primary">${esc(d.card.styleMain)}</span>` : ''}
          </div>
        </div>
      </div>`;
    }

    /* Difficulties */
    if (d.difficulties && d.difficulties.length) {
      html += `<div class="detail-section">
        <h6><i class="fas fa-skull-crossbones me-1"></i>Difficulties (${d.difficulties.length})</h6>
        <div class="table-responsive"><table class="table table-sm table-dark table-bordered">
          <thead><tr><th>Description</th><th>EXP</th><th>Weight</th><th>Characters</th><th>Coma</th><th>Max Stats</th><th>Free Actions</th></tr></thead>
          <tbody>${d.difficulties.map(diff => `<tr>
            <td>${esc(diff.description || '—')}</td><td>${diff.expCost}</td><td>${diff.maxWeight}</td>
            <td>${diff.minCharacter}–${diff.maxCharacter}</td><td>${diff.costHelpComa}</td>
            <td>${diff.costMaxCharacteristics}</td><td>${diff.numberMaxFreeAction}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
    }

    /* Character Templates */
    if (d.characterTemplates && d.characterTemplates.length) {
      html += `<div class="detail-section">
        <h6><i class="fas fa-users me-1"></i>Character Templates (${d.characterTemplates.length})</h6>
        <div class="table-responsive"><table class="table table-sm table-dark table-bordered">
          <thead><tr><th>Name</th><th>Description</th><th>Life</th><th>Energy</th><th>Sad</th><th>DEX</th><th>INT</th><th>CON</th></tr></thead>
          <tbody>${d.characterTemplates.map(ct => `<tr>
            <td>${esc(ct.name || '—')}</td><td>${esc(ct.description || '—')}</td>
            <td>${ct.lifeMax}</td><td>${ct.energyMax}</td><td>${ct.sadMax}</td>
            <td>${ct.dexterityStart}</td><td>${ct.intelligenceStart}</td><td>${ct.constitutionStart}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
    }

    /* Classes */
    if (d.classes && d.classes.length) {
      html += `<div class="detail-section">
        <h6><i class="fas fa-chess-rook me-1"></i>Classes (${d.classes.length})</h6>
        <div class="table-responsive"><table class="table table-sm table-dark table-bordered">
          <thead><tr><th>Name</th><th>Description</th><th>Weight Max</th><th>DEX</th><th>INT</th><th>CON</th></tr></thead>
          <tbody>${d.classes.map(c => `<tr>
            <td>${esc(c.name || '—')}</td><td>${esc(c.description || '—')}</td>
            <td>${c.weightMax}</td><td>${c.dexterityBase}</td><td>${c.intelligenceBase}</td><td>${c.constitutionBase}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
    }

    /* Traits */
    if (d.traits && d.traits.length) {
      html += `<div class="detail-section">
        <h6><i class="fas fa-star-half-alt me-1"></i>Traits (${d.traits.length})</h6>
        <div class="table-responsive"><table class="table table-sm table-dark table-bordered">
          <thead><tr><th>Name</th><th>Description</th><th>Cost +</th><th>Cost −</th><th>Permitted</th><th>Prohibited</th></tr></thead>
          <tbody>${d.traits.map(t => `<tr>
            <td>${esc(t.name || '—')}</td><td>${esc(t.description || '—')}</td>
            <td>${t.costPositive}</td><td>${t.costNegative}</td>
            <td>${t.idClassPermitted ?? '—'}</td><td>${t.idClassProhibited ?? '—'}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
    }

    return html;
  }

  /* ══════ Init ══════ */
  function init() {
    loadCategories();
    loadGroups();
    loadAllStories();
  }

  btnRefresh.addEventListener('click', init);
  init();

})();

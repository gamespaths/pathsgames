/**
 * Paths Games Admin CRUD — v0.17.0
 * Single-page admin client for story entity management.
 */
(function () {
    'use strict';

    const ENTITY_TYPES = [
        { key: 'locations', label: '📍 Locations' },
        { key: 'events', label: '⚡ Events' },
        { key: 'items', label: '🎒 Items' },
        { key: 'difficulties', label: '⚔️ Difficulties' },
        { key: 'character-templates', label: '👤 Characters' },
        { key: 'classes', label: '🏛️ Classes' },
        { key: 'traits', label: '✨ Traits' },
        { key: 'texts', label: '📝 Texts' },
        { key: 'cards', label: '🃏 Cards' },
        { key: 'creators', label: '🎨 Creators' }
    ];

    let state = { apiUrl: '', token: '', selectedStory: null, selectedType: 'locations', entities: [], textMap: {} };

    // === DOM refs ===
    const $ = id => document.getElementById(id);
    const apiUrlInput = $('api-url');
    const connStatus = $('connection-status');
    const storyListEl = $('story-list');
    const welcomePanel = $('welcome-panel');
    const entityPanel = $('entity-panel');
    const entityTabs = $('entity-tabs');
    const entityTbody = $('entity-tbody');
    const entityThead = $('entity-thead');
    const modalOverlay = $('modal-overlay');
    const modalTitle = $('modal-title');
    const modalBody = $('modal-body');

    // === API helpers ===
    async function api(method, path, body) {
        if (!state.apiUrl) return { ok: false, status: 0, data: null };
        try {
            const opts = { method, headers: { 'Content-Type': 'application/json' } };
            if (state.token) opts.headers['Authorization'] = 'Bearer ' + state.token;
            if (body) opts.body = JSON.stringify(body);
            const res = await fetch(state.apiUrl + path, opts);
            const data = await res.json().catch(() => null);
            return { ok: res.ok, status: res.status, data };
        } catch (e) {
            console.error('API error:', e.message);
            return { ok: false, status: 0, data: null };
        }
    }

    // === Connect ===
    $('btn-connect').onclick = async () => {
        state.apiUrl = apiUrlInput.value.replace(/\/$/, '');
        state.token = $('jwt-token').value.trim();
        if (!state.token) {
            connStatus.textContent = 'No Token';
            connStatus.className = 'badge badge-danger';
            return;
        }
        try {
            const res = await api('GET', '/api/echo/status');
            if (res.ok) {
                connStatus.textContent = 'Connected';
                connStatus.className = 'badge badge-success';
                await loadStories();
                $('btn-create-story').disabled = false;
            } else throw new Error('Not reachable');
        } catch (e) {
            connStatus.textContent = 'Error';
            connStatus.className = 'badge badge-danger';
        }
    };



    // === Stories ===
    async function loadStories() {
        const res = await api('GET', '/api/stories?lang=en');
        if (!res.ok) return;
        storyListEl.innerHTML = '';
        (res.data || []).forEach(s => {
            const div = document.createElement('div');
            div.className = 'story-item';
            div.innerHTML = `<div>${s.title || s.uuid}</div><div class="story-uuid">${s.uuid}</div>`;
            div.onclick = (evt) => selectStory(s, evt);
            storyListEl.appendChild(div);
        });
    }

    async function selectStory(story, evt) {
        state.selectedStory = story;
        document.querySelectorAll('.story-item').forEach(el => el.classList.remove('active'));
        if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
        welcomePanel.style.display = 'none';
        entityPanel.style.display = 'block';
        $('entity-panel-title').textContent = story.title || story.uuid;
        $('entity-search').value = '';
        await loadTextsForStory();
        renderTabs();
        loadEntities();
    }

    // === Load texts for lookup ===
    async function loadTextsForStory() {
        state.textMap = {};
        if (!state.selectedStory) return;
        const res = await api('GET', `/api/admin/stories/${state.selectedStory.uuid}/texts`);
        if (res.ok && Array.isArray(res.data)) {
            res.data.forEach(t => {
                const idText = t.idText;
                const lang = t.lang || 'en';
                const short = t.shortText || t.short_text || '';
                if (idText != null) {
                    // Prefer 'en', overwrite only if not already set or if this is 'en'
                    if (!state.textMap[idText] || lang === 'en') {
                        state.textMap[idText] = short;
                    }
                }
            });
        }
    }

    function resolveText(idText) {
        if (idText == null) return '';
        return state.textMap[idText] || '';
    }

    // === Entity tabs ===
    function renderTabs() {
        entityTabs.innerHTML = '';
        ENTITY_TYPES.forEach(t => {
            const tab = document.createElement('span');
            tab.className = 'entity-tab' + (t.key === state.selectedType ? ' active' : '');
            tab.textContent = t.label;
            tab.onclick = () => { state.selectedType = t.key; renderTabs(); loadEntities(); };
            entityTabs.appendChild(tab);
        });
    }

    // === Load entities ===
    async function loadEntities() {
        if (!state.selectedStory || !state.apiUrl) return;
        const res = await api('GET', `/api/admin/stories/${state.selectedStory.uuid}/${state.selectedType}`);
        state.entities = res.ok ? (res.data || []) : [];
        renderTable();
    }

    function renderTable(filter) {
        const searchTerm = (filter || '').toLowerCase();
        if (state.entities.length === 0) {
            entityThead.innerHTML = '<tr><th>No entities found</th></tr>';
            entityTbody.innerHTML = '<tr><td class="text-muted">No data. Click "+ New" to create one.</td></tr>';
            return;
        }
        // Build visible columns based on entity type
        let keys;
        if (state.selectedType === 'texts') {
            keys = ['uuid', 'idText', 'lang', 'shortText', 'idStory'];
            // Only keep keys that exist in the data
            const available = Object.keys(state.entities[0]);
            keys = keys.filter(k => available.includes(k));
        } else {
            keys = Object.keys(state.entities[0]).filter(k => k !== 'tsInsert' && k !== 'tsUpdate');
        }

        entityThead.innerHTML = '<tr>' + keys.map(k => `<th>${k}</th>`).join('') + '<th>Actions</th></tr>';

        const filtered = state.entities.filter(e => {
            if (!searchTerm) return true;
            return keys.some(k => {
                let val = String(e[k] ?? '');
                // Also search resolved text
                if (k === 'idTextName' || k === 'idTextDescription') val += ' ' + resolveText(e[k]);
                return val.toLowerCase().includes(searchTerm);
            });
        });

        entityTbody.innerHTML = filtered.map(e =>
            '<tr>' + keys.map(k => renderCell(k, e[k])).join('') +
            `<td class="actions">
                <button class="btn btn-outline btn-sm" onclick="window._editEntity('${e.uuid}')">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="window._deleteEntity('${e.uuid}')">🗑️</button>
            </td></tr>`
        ).join('');
    }

    function renderCell(key, value) {
        const v = value ?? '-';
        if (key === 'idTextName') {
            const label = resolveText(value);
            return `<td>${v}${label ? '<span class="text-label"> ' + escHtml(label) + '</span>' : ''}</td>`;
        }
        if (key === 'idTextDescription') {
            const tooltip = resolveText(value);
            return `<td title="${escHtml(tooltip)}">${v}</td>`;
        }
        return `<td title="${escHtml(String(v))}">${v}</td>`;
    }

    function escHtml(s) {
        if (!s) return '';
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // === Search ===
    $('entity-search').oninput = () => renderTable($('entity-search').value);

    // === CRUD operations ===
    $('btn-refresh').onclick = loadEntities;
    $('btn-create-entity').onclick = () => openModal('Create', {});

    window._editEntity = uuid => {
        const entity = state.entities.find(e => e.uuid === uuid);
        if (entity) openModal('Edit', entity);
    };

    window._deleteEntity = async uuid => {
        if (!confirm('Delete this entity?')) return;
        await api('DELETE', `/api/admin/stories/${state.selectedStory.uuid}/${state.selectedType}/${uuid}`);
        loadEntities();
    };

    function openModal(mode, entity) {
        modalTitle.textContent = mode + ' ' + state.selectedType;
        const fields = Object.keys(entity).filter(k => !['uuid', 'tsInsert', 'tsUpdate'].includes(k));
        if (fields.length === 0) {
            // New entity — show common fields
            modalBody.innerHTML = ['idTextName', 'idTextDescription', 'idCard'].map(k =>
                `<div class="form-group"><label>${k}</label><input id="field-${k}" value=""></div>`
            ).join('');
        } else {
            modalBody.innerHTML = fields.map(k =>
                `<div class="form-group"><label>${k}</label><input id="field-${k}" value="${entity[k] ?? ''}"></div>`
            ).join('');
        }
        modalOverlay.style.display = 'flex';

        $('btn-modal-save').onclick = async () => {
            const data = {};
            modalBody.querySelectorAll('input').forEach(inp => {
                const key = inp.id.replace('field-', '');
                const val = inp.value.trim();
                if (val) data[key] = isNaN(val) ? val : Number(val);
            });
            if (mode === 'Create') {
                await api('POST', `/api/admin/stories/${state.selectedStory.uuid}/${state.selectedType}`, data);
            } else {
                await api('PUT', `/api/admin/stories/${state.selectedStory.uuid}/${state.selectedType}/${entity.uuid}`, data);
            }
            closeModal();
            loadEntities();
        };
    }

    function closeModal() { modalOverlay.style.display = 'none'; }
    $('btn-modal-close').onclick = closeModal;
    $('btn-modal-cancel').onclick = closeModal;
    modalOverlay.onclick = e => { if (e.target === modalOverlay) closeModal(); };

    // Init
    renderTabs();
})();

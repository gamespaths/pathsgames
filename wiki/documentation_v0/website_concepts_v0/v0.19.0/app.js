/* eslint-disable no-undef */
// Paths Games — v0.19.0 player concept
// Demonstrates POST /api/matches and GET /api/match/{uuid}/info

const $ = (id) => document.getElementById(id);

const state = {
    apiUrl: 'http://localhost:8042',
    accessToken: null,
    userUuid: null,
    stories: [],
    selectedStory: null,
    selectedDifficultyUuid: null,
    matches: [],
    activeMatchUuid: null,
};

document.addEventListener('DOMContentLoaded', () => {
    $('btn-login-guest').addEventListener('click', loginGuest);
    $('btn-create-match').addEventListener('click', createMatch);
    $('btn-refresh-match').addEventListener('click', () => {
        if (state.activeMatchUuid) loadMatchInfo(state.activeMatchUuid);
    });
    $('api-url').addEventListener('change', (e) => {
        state.apiUrl = e.target.value.trim().replace(/\/$/, '');
    });
});

async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
    const res = await fetch(`${state.apiUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    if (!res.ok) {
        const message = (json && (json.message || json.error)) || `HTTP ${res.status}`;
        throw new Error(message);
    }
    return json;
}

async function loginGuest() {
    try {
        const r = await api('POST', '/api/auth/guest');
        state.accessToken = r.accessToken;
        state.userUuid = r.userUuid;
        $('auth-status').textContent = `Logged as ${r.username}`;
        $('auth-status').classList.remove('badge-warning');
        $('auth-status').classList.add('badge-success');
        await loadStories();
        await loadMatches();
    } catch (e) {
        $('auth-status').textContent = `Login failed: ${e.message}`;
        $('auth-status').classList.remove('badge-success');
        $('auth-status').classList.add('badge-danger');
    }
}

async function loadStories() {
    const list = await api('GET', '/api/stories');
    state.stories = list || [];
    const container = $('story-list');
    if (!state.stories.length) {
        container.innerHTML = '<p class="text-muted">No stories available</p>';
        return;
    }
    container.innerHTML = '';
    state.stories.forEach((s) => {
        const div = document.createElement('div');
        div.className = 'story-item';
        div.innerHTML = `
            <div class="story-title">${escapeHtml(s.title || s.uuid)}</div>
            <div class="story-meta">${escapeHtml(s.category || '')} ${s.priority ? '• priority ' + s.priority : ''}</div>
        `;
        div.addEventListener('click', () => selectStory(s));
        container.appendChild(div);
    });
}

async function selectStory(summary) {
    Array.from(document.querySelectorAll('.story-item')).forEach((d) => d.classList.remove('active'));
    event.currentTarget.classList.add('active');
    const detail = await api('GET', `/api/stories/${summary.uuid}`);
    state.selectedStory = detail;
    state.selectedDifficultyUuid = detail.difficulties && detail.difficulties[0]
        ? detail.difficulties[0].uuid
        : null;
    renderCreatePanel(detail);
}

function renderCreatePanel(story) {
    $('welcome-panel').style.display = 'none';
    $('match-panel').style.display = 'none';
    $('create-panel').style.display = '';
    $('create-panel-title').textContent = `▶ ${story.title || story.uuid}`;
    const body = $('create-panel-body');
    body.innerHTML = '';
    body.appendChild(buildField('Match name', 'input', 'match-name'));
    const diffSelect = document.createElement('select');
    diffSelect.id = 'difficulty';
    (story.difficulties || []).forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d.uuid;
        opt.textContent = `Difficulty • exp ${d.expCost} • max chars ${d.maxCharacter}`;
        diffSelect.appendChild(opt);
    });
    diffSelect.addEventListener('change', (e) => {
        state.selectedDifficultyUuid = e.target.value;
    });
    const diffLabel = document.createElement('label');
    diffLabel.textContent = 'Difficulty';
    diffLabel.appendChild(diffSelect);
    body.appendChild(diffLabel);

    const tplSelect = document.createElement('select');
    tplSelect.id = 'character-template';
    (story.characterTemplates || []).forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t.uuid;
        opt.textContent = t.name || t.uuid;
        tplSelect.appendChild(opt);
    });
    if (!tplSelect.options.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(no templates)';
        tplSelect.appendChild(opt);
    }
    const tplLabel = document.createElement('label');
    tplLabel.textContent = 'Character template (optional)';
    tplLabel.appendChild(tplSelect);
    body.appendChild(tplLabel);
    $('create-error').textContent = '';
}

function buildField(label, type, id) {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    const input = document.createElement(type);
    input.id = id;
    wrap.appendChild(input);
    return wrap;
}

async function createMatch() {
    if (!state.selectedStory) return;
    const name = $('match-name') && $('match-name').value;
    const tpl = $('character-template') && $('character-template').value;
    try {
        const created = await api('POST', '/api/matches', {
            storyUuid: state.selectedStory.uuid,
            difficultyUuid: state.selectedDifficultyUuid,
            name,
            characterTemplateUuid: tpl || undefined,
        });
        state.activeMatchUuid = created.uuid;
        await loadMatches();
        await loadMatchInfo(created.uuid);
    } catch (e) {
        $('create-error').textContent = `❌ ${e.message}`;
    }
}

async function loadMatches() {
    const list = await api('GET', '/api/matches');
    state.matches = list || [];
    const container = $('match-list');
    if (!state.matches.length) {
        container.innerHTML = '<p class="text-muted">No matches yet</p>';
        return;
    }
    container.innerHTML = '';
    state.matches.forEach((m) => {
        const div = document.createElement('div');
        div.className = 'story-item';
        div.innerHTML = `
            <div class="story-title">${escapeHtml(m.name || m.uuid.substring(0, 8))}</div>
            <div class="story-meta">${escapeHtml(m.status)} • clock ${m.currentClock}</div>
        `;
        div.addEventListener('click', () => loadMatchInfo(m.uuid));
        container.appendChild(div);
    });
}

async function loadMatchInfo(matchUuid) {
    state.activeMatchUuid = matchUuid;
    const info = await api('GET', `/api/match/${matchUuid}/info`);
    $('welcome-panel').style.display = 'none';
    $('create-panel').style.display = 'none';
    $('match-panel').style.display = '';
    $('match-panel-title').textContent = `Match ${info.match.uuid}`;
    $('match-summary').innerHTML = '';
    pushPill('Status', info.match.status);
    pushPill('Clock', info.match.currentClock);
    pushPill('Exp cost', info.match.expCost);
    pushPill('Created', info.match.tsInsert);
    pushPill('Current location', info.currentLocationName || info.currentLocationUuid || '—');

    const locContainer = $('match-locations');
    locContainer.innerHTML = '';
    info.locations.forEach((l) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-name">📍 ${escapeHtml(l.name || ('loc-' + l.idLocation))}</div>
            <div class="card-meta">flag ${l.flagAlreadyActived} • counter ${l.clockCounter}</div>
        `;
        locContainer.appendChild(card);
    });

    const regBody = $('match-registry-body');
    regBody.innerHTML = '';
    info.registry.forEach((r) => {
        const tr = document.createElement('tr');
        const value = r.intValue !== null && r.intValue !== undefined
            ? r.intValue
            : r.stringValue;
        tr.innerHTML = `<td>${escapeHtml(r.key)}</td><td>${escapeHtml(String(value === null ? '' : value))}</td>`;
        regBody.appendChild(tr);
    });
}

function pushPill(key, value) {
    const div = document.createElement('div');
    div.className = 'pill';
    div.innerHTML = `
        <div class="pill-key">${escapeHtml(key)}</div>
        <div class="pill-value">${escapeHtml(String(value === null ? '' : value))}</div>
    `;
    $('match-summary').appendChild(div);
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

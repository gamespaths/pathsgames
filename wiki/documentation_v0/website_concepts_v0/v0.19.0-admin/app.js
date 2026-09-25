/* eslint-disable no-undef */
// Paths Games — v0.19.0 admin match inspector concept

const $ = (id) => document.getElementById(id);

const state = {
    apiUrl: 'http://localhost:8042',
    token: null,
};

document.addEventListener('DOMContentLoaded', () => {
    $('btn-connect').addEventListener('click', () => {
        state.token = $('jwt-token').value.trim();
        state.apiUrl = $('api-url').value.trim().replace(/\/$/, '');
        if (state.token) {
            $('auth-status').textContent = 'Connected';
            $('auth-status').classList.remove('badge-warning');
            $('auth-status').classList.add('badge-success');
        } else {
            $('auth-status').textContent = 'Token missing';
        }
    });
    $('btn-inspect').addEventListener('click', () => {
        const id = $('match-uuid').value.trim();
        if (id) loadMatchInfo(id);
    });
    $('btn-refresh-match').addEventListener('click', () => {
        const id = $('match-uuid').value.trim();
        if (id) loadMatchInfo(id);
    });
});

async function api(method, path) {
    const headers = {};
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(`${state.apiUrl}${path}`, { method, headers });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    if (!res.ok) {
        const message = (json && (json.message || json.error)) || `HTTP ${res.status}`;
        throw new Error(message);
    }
    return json;
}

async function loadMatchInfo(uuidMatch) {
    try {
        const info = await api('GET', `/api/match/${uuidMatch}/info`);
        $('welcome-panel').style.display = 'none';
        $('match-panel').style.display = '';
        $('match-panel-title').textContent = `Match ${info.match.uuid}`;
        $('match-summary').innerHTML = '';
        pushPill('Status', info.match.status);
        pushPill('Clock', info.match.currentClock);
        pushPill('Story uuid', info.match.storyUuid);
        pushPill('Difficulty uuid', info.match.difficultyUuid);
        pushPill('Creator', info.match.userCreatorUuid);
        pushPill('Created', info.match.tsInsert);

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
    } catch (e) {
        $('auth-status').textContent = e.message;
        $('auth-status').classList.add('badge-danger');
    }
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

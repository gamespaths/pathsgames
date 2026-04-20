/**
 * Paths Games v0.16.0 — Content Detail API Explorer
 * Vanilla JS that calls the three new /api/content/ endpoints
 * and renders the JSON response (or human-friendly preview).
 */

/* ── helpers ─────────────────────────────────────────────── */

function baseUrl() {
  return document.getElementById('base-url').value.replace(/\/+$/, '');
}

function setResult(elId, status, body) {
  const box = document.getElementById(elId);
  box.className = 'result-box';
  let badge = '';
  if (status >= 200 && status < 300) {
    box.classList.add('success');
    badge = `<span class="status-badge status-200">${status} OK</span>\n`;
  } else if (status === 404) {
    box.classList.add('error');
    badge = `<span class="status-badge status-404">${status} Not Found</span>\n`;
  } else {
    box.classList.add('error');
    badge = `<span class="status-badge status-err">${status} Error</span>\n`;
  }
  box.innerHTML = badge + escapeHtml(JSON.stringify(body, null, 2));
}

function setError(elId, msg) {
  const box = document.getElementById(elId);
  box.className = 'result-box error';
  box.innerHTML = `<span class="status-badge status-err">Error</span>\n${escapeHtml(msg)}`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Card Detail ─────────────────────────────────────────── */

async function fetchCard() {
  const storyUuid = document.getElementById('card-story-uuid').value.trim();
  const cardUuid  = document.getElementById('card-uuid').value.trim();
  const lang      = document.getElementById('card-lang').value.trim() || 'en';
  const preview   = document.getElementById('card-preview');
  preview.style.display = 'none';

  if (!storyUuid || !cardUuid) {
    setError('card-result', 'Please enter both Story UUID and Card UUID.');
    return;
  }

  const url = `${baseUrl()}/api/content/${encodeURIComponent(storyUuid)}/cards/${encodeURIComponent(cardUuid)}?lang=${encodeURIComponent(lang)}`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    setResult('card-result', resp.status, data);

    if (resp.ok) {
      renderCardPreview(data, preview);
    }
  } catch (err) {
    setError('card-result', `Network error: ${err.message}`);
  }
}

function renderCardPreview(card, container) {
  let html = '<div class="card-preview">';
  if (card.imageUrl) {
    html += `<img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.title || 'Card')}" onerror="this.style.display='none'" />`;
  }
  html += `<h4>${card.awesomeIcon ? '<i class="fas ' + escapeHtml(card.awesomeIcon) + ' me-2"></i>' : ''}${escapeHtml(card.title || '—')}</h4>`;
  if (card.description) {
    html += `<p>${escapeHtml(card.description)}</p>`;
  }
  if (card.copyrightText) {
    const link = card.linkCopyright ? `<a href="${escapeHtml(card.linkCopyright)}" target="_blank" rel="noopener" style="color:var(--gold)">${escapeHtml(card.copyrightText)}</a>` : escapeHtml(card.copyrightText);
    html += `<p class="meta"><i class="fas fa-copyright me-1"></i>${link}</p>`;
  }
  if (card.creator) {
    html += renderCreatorBadge(card.creator);
  }
  html += '</div>';
  container.innerHTML = html;
  container.style.display = 'block';
}

/* ── Text Detail ─────────────────────────────────────────── */

async function fetchText() {
  const storyUuid = document.getElementById('text-story-uuid').value.trim();
  const idText    = document.getElementById('text-id').value.trim();
  const lang      = document.getElementById('text-lang').value.trim() || 'en';

  if (!storyUuid || !idText) {
    setError('text-result', 'Please enter both Story UUID and id_text.');
    return;
  }

  const url = `${baseUrl()}/api/content/${encodeURIComponent(storyUuid)}/texts/${encodeURIComponent(idText)}/lang/${encodeURIComponent(lang)}`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    setResult('text-result', resp.status, data);
  } catch (err) {
    setError('text-result', `Network error: ${err.message}`);
  }
}

/* ── Creator Detail ──────────────────────────────────────── */

async function fetchCreator() {
  const storyUuid  = document.getElementById('creator-story-uuid').value.trim();
  const creatorUuid = document.getElementById('creator-uuid').value.trim();
  const lang       = document.getElementById('creator-lang').value.trim() || 'en';

  if (!storyUuid || !creatorUuid) {
    setError('creator-result', 'Please enter both Story UUID and Creator UUID.');
    return;
  }

  const url = `${baseUrl()}/api/content/${encodeURIComponent(storyUuid)}/creators/${encodeURIComponent(creatorUuid)}?lang=${encodeURIComponent(lang)}`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    setResult('creator-result', resp.status, data);
  } catch (err) {
    setError('creator-result', `Network error: ${err.message}`);
  }
}

/* ── Shared creator badge renderer ───────────────────────── */

function renderCreatorBadge(creator) {
  let html = '<div class="creator-badge mt-2">';
  if (creator.urlImage) {
    html += `<img src="${escapeHtml(creator.urlImage)}" alt="${escapeHtml(creator.name || 'Creator')}" onerror="this.style.display='none'" />`;
  } else {
    html += '<i class="fas fa-user-circle" style="font-size:1.2rem;color:var(--gold)"></i>';
  }
  const name = escapeHtml(creator.name || 'Unknown');
  if (creator.link) {
    html += `<a href="${escapeHtml(creator.link)}" target="_blank" rel="noopener" style="color:var(--gold-light)">${name}</a>`;
  } else {
    html += `<span>${name}</span>`;
  }
  html += '</div>';
  return html;
}

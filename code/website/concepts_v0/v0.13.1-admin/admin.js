/* =============================================
   PATHS GAMES — admin.js (v0.13.1-admin)
   Admin panel: login + guest management + session management

   HttpOnly cookie edition:
   - refreshToken → HttpOnly cookie (set by server, invisible to JS)
   - guestCookieToken → HttpOnly cookie (set by server, invisible to JS)
   - accessToken → kept in memory + localStorage (short-lived, needed for Bearer header)
   - All fetch() calls use credentials:'include' so cookies are sent automatically
   ============================================= */

(function () {
  'use strict';

  /* ══════════════════════════════════════════
     CONFIGURATION
     ══════════════════════════════════════════ */
  const API_BASE = 'http://localhost:8042';
  const ENDPOINTS = {
    echo:         API_BASE + '/api/echo/status',
    guestLogin:   API_BASE + '/api/auth/guest',
    guestResume:  API_BASE + '/api/auth/guest/resume',
    me:           API_BASE + '/api/auth/me',
    refresh:      API_BASE + '/api/auth/refresh',
    logout:       API_BASE + '/api/auth/logout',
    logoutAll:    API_BASE + '/api/auth/logout/all',
    guests:       API_BASE + '/api/admin/guests',
    guestStats:   API_BASE + '/api/admin/guests/stats',
    guestExpired: API_BASE + '/api/admin/guests/expired',
  };

  /* ══════════════════════════════════════════
     STATE
     ══════════════════════════════════════════ */
  let accessToken  = null;
  let accessTokenExpiresAt  = 0;   // epoch ms
  let refreshTokenExpiresAt = 0;   // epoch ms
  // refreshToken is now in an HttpOnly cookie — not accessible from JS
  let currentModalUuid = null;
  let expiryIntervalId  = null;

  const STORAGE_KEY = 'pg_admin_session_v1';

  /* ══════════════════════════════════════════
     DOM
     ══════════════════════════════════════════ */
  const loginScreen   = document.getElementById('loginScreen');
  const appScreen     = document.getElementById('appScreen');
  const tokenInput    = document.getElementById('tokenInput');
  const loginError    = document.getElementById('loginError');
  const loginStatusDot  = document.getElementById('loginStatusDot');
  const loginStatusText = document.getElementById('loginStatusText');
  const appStatusDot    = document.getElementById('appStatusDot');
  const appStatusText   = document.getElementById('appStatusText');
  const navUsername   = document.getElementById('navUsername');
  const navRole       = document.getElementById('navRole');
  const sesUuid       = document.getElementById('sesUuid');
  const sesUsername   = document.getElementById('sesUsername');
  const sesRole       = document.getElementById('sesRole');
  const sesExpiry     = document.getElementById('sesExpiry');
  const tokenExpiryFill  = document.getElementById('tokenExpiryFill');
  const tokenExpiryLabel = document.getElementById('tokenExpiryLabel');
  const statTotal     = document.getElementById('statTotal');
  const statActive    = document.getElementById('statActive');
  const statExpired   = document.getElementById('statExpired');
  const guestTableBody = document.getElementById('guestTableBody');
  const modalOverlay  = document.getElementById('modalOverlay');
  const modalBody     = document.getElementById('modalBody');
  const notification  = document.getElementById('notification');
  const logArea       = document.getElementById('logArea');
  const btnRefreshTok = document.getElementById('btnRefreshTok');

  /* ══════════════════════════════════════════
     EXPOSE TO HTML onclick
     ══════════════════════════════════════════ */
  window.loginWithToken   = loginWithToken;
  window.loginAsGuest     = loginAsGuest;
  window.doLogout         = doLogout;
  window.refreshMyToken   = refreshMyToken;
  window.revokeAllMySessions = revokeAllMySessions;
  window.loadData         = loadData;
  window.cleanupExpired   = cleanupExpired;
  window.createTestGuest  = createTestGuest;
  window.viewGuest        = viewGuest;
  window.deleteGuest      = deleteGuest;
  window.deleteFromModal  = deleteFromModal;
  window.closeModal       = closeModal;

  /* ══════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════ */
  (function init() {
    checkServerStatus();
    // Try to restore a saved session
    const saved = loadSavedSession();
    if (saved) {
      accessToken  = saved.accessToken;
      accessTokenExpiresAt  = saved.accessTokenExpiresAt  || 0;
      refreshTokenExpiresAt = saved.refreshTokenExpiresAt || 0;
      // Validate the restored token
      validateAndEnter(accessToken);
    }
  })();

  /* ══════════════════════════════════════════
     SERVER STATUS
     ══════════════════════════════════════════ */
  async function checkServerStatus() {
    try {
      const res = await fetch(ENDPOINTS.echo);
      if (res.ok) {
        const data = await res.json();
        const ver = data.properties?.version || '?';
        setStatus(loginStatusDot, loginStatusText, true, 'Server OK — v' + ver);
        setStatus(appStatusDot,   appStatusText,   true, 'v' + ver);
      } else {
        throw new Error('HTTP ' + res.status);
      }
    } catch (e) {
      setStatus(loginStatusDot, loginStatusText, false, 'Server offline');
      setStatus(appStatusDot,   appStatusText,   false, 'Offline');
    }
  }

  function setStatus(dot, label, online, text) {
    if (!dot || !label) return;
    if (online) dot.classList.add('online');
    else dot.classList.remove('online');
    label.textContent = text;
  }

  /* ══════════════════════════════════════════
     LOGIN — paste token
     ══════════════════════════════════════════ */
  async function loginWithToken() {
    const raw = (tokenInput.value || '').trim();
    if (!raw) {
      showLoginError('Please paste your access token.');
      return;
    }
    hideLoginError();
    document.getElementById('btnLoginToken').disabled = true;
    logEntry('inf', 'Verifying pasted token…');

    try {
      const res = await fetch(ENDPOINTS.me, {
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + raw }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'HTTP ' + res.status);
      }

      const data = await res.json();
      accessToken  = raw;
      accessTokenExpiresAt  = 0;
      refreshTokenExpiresAt = 0;
      saveSession();

      logEntry('ok', 'Authenticated as ' + data.username + ' [' + data.role + ']');
      enterDashboard(data);
    } catch (e) {
      logEntry('err', 'Token validation failed: ' + e.message);
      showLoginError(e.message || 'Invalid token. Make sure it is a valid, non-expired access JWT.');
    } finally {
      document.getElementById('btnLoginToken').disabled = false;
    }
  }

  /* ══════════════════════════════════════════
     LOGIN — guest demo
     ══════════════════════════════════════════ */
  async function loginAsGuest() {
    hideLoginError();
    document.getElementById('btnLoginGuest').disabled = true;
    logEntry('inf', 'Creating guest session…');

    try {
      const res = await fetch(ENDPOINTS.guestLogin, {
        method: 'POST',
        credentials: 'include'   // receive HttpOnly cookies
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      accessToken  = data.accessToken;
      accessTokenExpiresAt  = data.accessTokenExpiresAt  || 0;
      refreshTokenExpiresAt = data.refreshTokenExpiresAt || 0;
      saveSession();

      logEntry('ok', 'Guest session created: ' + data.username + ' [PLAYER]');
      logEntry('inf', 'refreshToken + guestCookieToken set as HttpOnly cookies (invisible to JS)');
      logEntry('inf', 'Note: admin API calls will fail with 403 — demonstrating auth filter');

      // Fill textarea for transparency
      tokenInput.value = accessToken;

      // Validate
      const meRes = await fetch(ENDPOINTS.me, {
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      const meData = await meRes.json();
      enterDashboard(meData);
    } catch (e) {
      logEntry('err', 'Guest login failed: ' + e.message);
      showLoginError(e.message || 'Could not connect to server.');
    } finally {
      document.getElementById('btnLoginGuest').disabled = false;
    }
  }

  /* ══════════════════════════════════════════
     VALIDATE AND ENTER (on page reload)
     ══════════════════════════════════════════ */
  async function validateAndEnter(token) {
    try {
      const res = await fetch(ENDPOINTS.me, {
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Token expired or invalid');
      const data = await res.json();
      logEntry('inf', 'Session restored: ' + data.username);
      enterDashboard(data);
    } catch (e) {
      clearSession();
      logEntry('err', 'Saved session invalid: ' + e.message);
    }
  }

  /* ══════════════════════════════════════════
     ENTER DASHBOARD
     ══════════════════════════════════════════ */
  function enterDashboard(meData) {
    // Update navbar
    navUsername.textContent = meData.username || '—';
    navRole.textContent     = meData.role || '—';
    navRole.className       = 'user-badge ' +
      (meData.role === 'ADMIN' ? 'badge-admin' : 'badge-player');

    // Update session card
    sesUuid.textContent     = meData.userUuid || '—';
    sesUsername.textContent = meData.username || '—';
    sesRole.textContent     = meData.role || '—';

    // Refresh-token button: always enabled — server checks HttpOnly cookie
    btnRefreshTok.disabled  = false;

    // Start expiry bar
    startExpiryBar();

    // Show/hide screens
    loginScreen.style.display = 'none';
    appScreen.style.display   = 'flex';

    // Load dashboard data
    checkServerStatus();
    loadData();
  }

  /* ══════════════════════════════════════════
     TOKEN EXPIRY BAR
     ══════════════════════════════════════════ */
  function startExpiryBar() {
    if (expiryIntervalId) clearInterval(expiryIntervalId);
    updateExpiryBar();
    expiryIntervalId = setInterval(updateExpiryBar, 5000);
  }

  function updateExpiryBar() {
    const now = Date.now();
    if (!accessTokenExpiresAt) {
      sesExpiry.textContent          = 'unknown';
      tokenExpiryFill.style.width    = '100%';
      tokenExpiryLabel.textContent   = 'Token expiry unknown (pasted token)';
      return;
    }

    const issuedAt = accessTokenExpiresAt - 30 * 60 * 1000; // assume 30min lifetime
    const total    = accessTokenExpiresAt - issuedAt;
    const remain   = accessTokenExpiresAt - now;
    const pct      = Math.max(0, Math.min(100, (remain / total) * 100));

    sesExpiry.textContent = formatDate(new Date(accessTokenExpiresAt).toISOString());
    tokenExpiryFill.style.width = pct.toFixed(1) + '%';
    tokenExpiryFill.style.background = pct > 30
      ? 'linear-gradient(90deg, var(--color-success-light), var(--color-gold-light))'
      : 'linear-gradient(90deg, var(--color-error-light), var(--color-warning-light))';

    if (remain <= 0) {
      tokenExpiryLabel.textContent = '⚠ Token expired — please refresh or login again';
    } else {
      const mins = Math.floor(remain / 60000);
      const secs = Math.floor((remain % 60000) / 1000);
      tokenExpiryLabel.textContent = 'Expires in ' + mins + 'm ' + secs + 's';
    }
  }

  /* ══════════════════════════════════════════
     REFRESH TOKEN (Step 13)
     ══════════════════════════════════════════ */
  async function refreshMyToken() {
    logEntry('inf', 'Refreshing tokens (cookie sent automatically)…');

    try {
      const res = await fetch(ENDPOINTS.refresh, {
        method: 'POST',
        credentials: 'include'   // send + receive HttpOnly cookies
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'HTTP ' + res.status);
      }

      const data = await res.json();
      accessToken  = data.accessToken;
      accessTokenExpiresAt  = data.accessTokenExpiresAt  || 0;
      refreshTokenExpiresAt = data.refreshTokenExpiresAt || 0;
      saveSession();

      logEntry('ok', 'Token refreshed — new pair issued, old tokens revoked (rotation complete)');
      showNotification('success', 'Tokens refreshed successfully');
      updateExpiryBar();

      // Refresh session card from /me
      const meRes = await fetch(ENDPOINTS.me, {
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        sesUuid.textContent     = meData.userUuid || '—';
        sesUsername.textContent = meData.username || '—';
        sesRole.textContent     = meData.role || '—';
        navUsername.textContent = meData.username || '—';
      }
    } catch (e) {
      logEntry('err', 'Refresh failed: ' + e.message);
      showNotification('error', e.message);
    }
  }

  /* ══════════════════════════════════════════
     REVOKE ALL MY SESSIONS (Step 13)
     ══════════════════════════════════════════ */
  async function revokeAllMySessions() {
    if (!confirm('Revoke ALL your active sessions? You will be logged out.')) return;
    logEntry('inf', 'Revoking all sessions…');

    try {
      const res = await fetch(ENDPOINTS.logoutAll, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'HTTP ' + res.status);
      }

      logEntry('ok', 'All sessions revoked — cookies cleared by server');
      showNotification('success', 'All sessions revoked');
      setTimeout(doLogout, 1200);
    } catch (e) {
      logEntry('err', 'Revoke-all failed: ' + e.message);
      showNotification('error', e.message);
    }
  }

  /* ══════════════════════════════════════════
     LOGOUT
     ══════════════════════════════════════════ */
  function doLogout() {
    if (expiryIntervalId) clearInterval(expiryIntervalId);
    clearSession();
    logEntry('inf', 'Logged out');
    appScreen.style.display   = 'none';
    loginScreen.style.display = 'flex';
    tokenInput.value = '';
    hideLoginError();
    checkServerStatus();
  }

  /* ══════════════════════════════════════════
     LOAD DATA
     ══════════════════════════════════════════ */
  async function loadData() {
    logEntry('inf', 'Loading dashboard data…');
    await Promise.all([loadStats(), loadGuests()]);
  }

  /* ── Stats ── */
  async function loadStats() {
    try {
      const res = await authFetch(ENDPOINTS.guestStats);
      if (!res) return;
      if (res.status === 403) {
        statTotal.textContent = statActive.textContent = statExpired.textContent = '403';
        logEntry('err', 'Guest stats: 403 Forbidden (need ADMIN role)');
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      statTotal.textContent   = data.totalGuests   ?? '?';
      statActive.textContent  = data.activeGuests  ?? '?';
      statExpired.textContent = data.expiredGuests ?? '?';
    } catch (e) {
      statTotal.textContent = statActive.textContent = statExpired.textContent = '?';
      logEntry('err', 'Stats load error: ' + e.message);
    }
  }

  /* ── Guests ── */
  async function loadGuests() {
    try {
      const res = await authFetch(ENDPOINTS.guests);
      if (!res) return;
      if (res.status === 403) {
        guestTableBody.innerHTML =
          '<tr><td colspan="7" class="error-row">' +
          '<i class="fas fa-ban"></i> 403 Forbidden — ADMIN role required</td></tr>';
        logEntry('err', 'Guest list: 403 Forbidden (need ADMIN role)');
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const guests = await res.json();
      renderGuestTable(guests);
      logEntry('ok', 'Loaded ' + guests.length + ' guest(s)');
    } catch (e) {
      guestTableBody.innerHTML =
        '<tr><td colspan="7" class="error-row">' +
        '<i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(e.message) + '</td></tr>';
      logEntry('err', 'Guest load error: ' + e.message);
    }
  }

  /* ══════════════════════════════════════════
     RENDER GUEST TABLE
     ══════════════════════════════════════════ */
  function renderGuestTable(guests) {
    if (!guests || guests.length === 0) {
      guestTableBody.innerHTML =
        '<tr><td colspan="7" class="empty-row">' +
        '<i class="fas fa-ghost"></i> No guest users found</td></tr>';
      return;
    }

    guestTableBody.innerHTML = guests.map(g => {
      const badgeCls   = g.expired ? 'badge-expired' : 'badge-active';
      const badgeTxt   = g.expired ? 'Expired' : 'Active';
      const rowCls     = g.expired ? 'row-expired' : '';
      const uuidShort  = shortUuid(g.userUuid);
      return `
        <tr class="${rowCls}">
          <td>${escapeHtml(g.username)}</td>
          <td class="col-uuid" title="${escapeHtml(g.userUuid)}" onclick="copyText('${escapeHtml(g.userUuid)}')">${uuidShort}</td>
          <td><span class="badge ${badgeCls}">${badgeTxt}</span></td>
          <td>${formatDate(g.tsRegistration)}</td>
          <td>${formatDate(g.tsLastAccess)}</td>
          <td>${formatDate(g.guestExpiresAt)}</td>
          <td class="col-actions">
            <button class="btn-icon btn-view" title="View details"
                    onclick="viewGuest('${escapeHtml(g.userUuid)}')">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn-icon btn-del" title="Delete"
                    onclick="deleteGuest('${escapeHtml(g.userUuid)}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>`;
    }).join('');
  }

  /* ══════════════════════════════════════════
     VIEW GUEST (MODAL)
     ══════════════════════════════════════════ */
  async function viewGuest(uuid) {
    currentModalUuid = uuid;
    try {
      const res = await authFetch(ENDPOINTS.guests + '/' + uuid);
      if (!res) return;
      if (res.status === 403) {
        showNotification('error', '403 Forbidden — ADMIN role required');
        return;
      }
      if (!res.ok) throw new Error('Guest not found');
      const g = await res.json();

      const badgeCls = g.expired ? 'badge-expired' : 'badge-active';
      const badgeTxt = g.expired ? 'Expired' : 'Active';

      modalBody.innerHTML = `
        <ul class="detail-list">
          <li><span class="detail-label">Username</span>
              <span class="detail-value">${escapeHtml(g.username)}</span></li>
          <li><span class="detail-label">UUID</span>
              <span class="detail-value mono">${escapeHtml(g.userUuid)}</span></li>
          <li><span class="detail-label">Nickname</span>
              <span class="detail-value">${escapeHtml(g.nickname || '—')}</span></li>
          <li><span class="detail-label">Role</span>
              <span class="detail-value"><span class="badge badge-player">${escapeHtml(g.role)}</span></span></li>
          <li><span class="detail-label">State</span>
              <span class="detail-value">${g.state} (guest)</span></li>
          <li><span class="detail-label">Status</span>
              <span class="detail-value"><span class="badge ${badgeCls}">${badgeTxt}</span></span></li>
          <li><span class="detail-label">Language</span>
              <span class="detail-value">${escapeHtml(g.language || '—')}</span></li>
          <li><span class="detail-label">Cookie token</span>
              <span class="detail-value mono">${escapeHtml(g.guestCookieToken || '—')}</span></li>
          <li><span class="detail-label">Registered</span>
              <span class="detail-value">${formatDate(g.tsRegistration)}</span></li>
          <li><span class="detail-label">Last access</span>
              <span class="detail-value">${formatDate(g.tsLastAccess)}</span></li>
          <li><span class="detail-label">Expires</span>
              <span class="detail-value">${formatDate(g.guestExpiresAt)}</span></li>
        </ul>`;

      modalOverlay.classList.add('visible');
    } catch (e) {
      showNotification('error', e.message);
    }
  }

  /* ══════════════════════════════════════════
     DELETE GUEST
     ══════════════════════════════════════════ */
  async function deleteGuest(uuid) {
    if (!confirm('Delete guest ' + uuid.substring(0, 8) + '…?')) return;
    logEntry('inf', 'Deleting guest ' + shortUuid(uuid) + '…');

    try {
      const res = await authFetch(ENDPOINTS.guests + '/' + uuid, { method: 'DELETE' });
      if (!res) return;
      if (res.status === 403) {
        showNotification('error', '403 Forbidden — ADMIN role required');
        logEntry('err', 'Delete guest: 403 Forbidden');
        return;
      }
      if (!res.ok) throw new Error('Delete failed');
      showNotification('success', 'Guest deleted: ' + shortUuid(uuid));
      logEntry('ok', 'Deleted guest ' + shortUuid(uuid));
      loadData();
    } catch (e) {
      showNotification('error', e.message);
      logEntry('err', 'Delete error: ' + e.message);
    }
  }

  async function deleteFromModal() {
    if (currentModalUuid) {
      closeModal();
      await deleteGuest(currentModalUuid);
    }
  }

  /* ══════════════════════════════════════════
     CLEANUP EXPIRED
     ══════════════════════════════════════════ */
  async function cleanupExpired() {
    if (!confirm('Remove ALL expired guest sessions?')) return;
    logEntry('inf', 'Cleaning up expired guests…');

    try {
      const res = await authFetch(ENDPOINTS.guestExpired, { method: 'DELETE' });
      if (!res) return;
      if (res.status === 403) {
        showNotification('error', '403 Forbidden — ADMIN role required');
        logEntry('err', 'Cleanup: 403 Forbidden');
        return;
      }
      if (!res.ok) throw new Error('Cleanup failed');
      const data = await res.json();
      showNotification('success', 'Cleaned up ' + data.deletedCount + ' expired guest(s)');
      logEntry('ok', 'Cleanup complete: removed ' + data.deletedCount + ' expired guest(s)');
      loadData();
    } catch (e) {
      showNotification('error', e.message);
      logEntry('err', 'Cleanup error: ' + e.message);
    }
  }

  /* ══════════════════════════════════════════
     CREATE TEST GUEST
     ══════════════════════════════════════════ */
  async function createTestGuest() {
    logEntry('inf', 'Creating test guest…');
    try {
      const res = await fetch(ENDPOINTS.guestLogin, {
        method: 'POST',
        credentials: 'include'   // receive HttpOnly cookies
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      showNotification('success', 'Created guest: ' + data.username);
      logEntry('ok', 'Test guest created: ' + data.username + ' (' + shortUuid(data.userUuid) + ')');
      loadData();
    } catch (e) {
      showNotification('error', e.message);
      logEntry('err', 'Create guest error: ' + e.message);
    }
  }

  /* ══════════════════════════════════════════
     MODAL
     ══════════════════════════════════════════ */
  function closeModal(event) {
    if (event && event.target !== modalOverlay) return;
    modalOverlay.classList.remove('visible');
    currentModalUuid = null;
  }

  /* ══════════════════════════════════════════
     AUTH FETCH (auto-sets Authorization header)
     ══════════════════════════════════════════ */
  async function authFetch(url, options) {
    const opts = options || {};
    opts.credentials = 'include';   // always send HttpOnly cookies
    opts.headers = Object.assign({ 'Authorization': 'Bearer ' + accessToken }, opts.headers || {});
    if (opts.body && !opts.headers['Content-Type']) {
      opts.headers['Content-Type'] = 'application/json';
    }
    return fetch(url, opts);
  }

  /* ══════════════════════════════════════════
     SESSION PERSISTENCE (localStorage)
     ══════════════════════════════════════════ */
  function saveSession() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        accessToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt
        // refreshToken is in HttpOnly cookie — not stored here
      }));
    } catch (_) {}
  }

  function loadSavedSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function clearSession() {
    accessToken = null;
    accessTokenExpiresAt = refreshTokenExpiresAt = 0;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    // HttpOnly cookies are cleared by the server on logout responses
  }

  /* ══════════════════════════════════════════
     ACTIVITY LOG
     ══════════════════════════════════════════ */
  function logEntry(type, message) {
    const ts = new Date().toLocaleTimeString();
    const cls = type === 'ok' ? 'log-ok' : type === 'err' ? 'log-err' : 'log-inf';
    const icon = type === 'ok' ? '✓' : type === 'err' ? '✗' : '·';
    const line = document.createElement('div');
    line.innerHTML =
      '<span class="log-ts">' + ts + '</span>' +
      '<span class="' + cls + '">' + icon + ' ' + escapeHtml(message) + '</span>';
    logArea.appendChild(line);
    logArea.scrollTop = logArea.scrollHeight;
  }

  /* ══════════════════════════════════════════
     NOTIFICATIONS
     ══════════════════════════════════════════ */
  let notifTimer = null;
  function showNotification(type, message) {
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
    notification.className = 'notification notif-' + type;
    notification.innerHTML = '<i class="fas ' + icon + '"></i> ' + escapeHtml(message);
    notification.style.display = 'block';
    if (notifTimer) clearTimeout(notifTimer);
    notifTimer = setTimeout(() => { notification.style.display = 'none'; }, 4000);
  }

  /* ══════════════════════════════════════════
     LOGIN UI HELPERS
     ══════════════════════════════════════════ */
  function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
  }
  function hideLoginError() {
    loginError.style.display = 'none';
  }

  /* ══════════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════════ */
  function formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      return new Date(isoStr).toLocaleString();
    } catch (_) {
      return isoStr;
    }
  }

  function shortUuid(uuid) {
    if (!uuid) return '—';
    return uuid.substring(0, 8) + '…';
  }

  function escapeHtml(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  // Expose copy helper (used in table UUID click)
  window.copyText = function (text) {
    navigator.clipboard.writeText(text)
      .then(() => showNotification('success', 'Copied: ' + text.substring(0, 16) + '…'))
      .catch(() => {});
  };

})();

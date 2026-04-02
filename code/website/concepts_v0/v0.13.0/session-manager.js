/* =============================================
   PATHS GAMES — session-manager.js (v0.13.0)
   Session & Token Management — Step 13 concept

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
    guestLogin:   API_BASE + '/api/auth/guest',
    guestResume:  API_BASE + '/api/auth/guest/resume',
    refresh:      API_BASE + '/api/auth/refresh',
    logout:       API_BASE + '/api/auth/logout',
    logoutAll:    API_BASE + '/api/auth/logout/all',
    me:           API_BASE + '/api/auth/me',
    echoStatus:   API_BASE + '/api/echo/status',
    adminGuests:  API_BASE + '/api/admin/guests'
  };

  const STORAGE_KEY = 'paths_session_v013';

  /* ══════════════════════════════════════════
     DOM REFERENCES
     ══════════════════════════════════════════ */
  const loginView       = document.getElementById('loginView');
  const sessionView     = document.getElementById('sessionView');
  const btnGuestLogin   = document.getElementById('btnGuestLogin');
  const loginError      = document.getElementById('loginError');
  const statusDot       = document.getElementById('statusDot');
  const statusText      = document.getElementById('statusText');

  const sessUsername     = document.getElementById('sessUsername');
  const sessUuid        = document.getElementById('sessUuid');
  const sessRole        = document.getElementById('sessRole');
  const sessAccessExp   = document.getElementById('sessAccessExp');
  const sessRefreshExp  = document.getElementById('sessRefreshExp');
  const sessAccessToken = document.getElementById('sessAccessToken');
  const sessRefreshToken= document.getElementById('sessRefreshToken');
  const logBox          = document.getElementById('logBox');

  /* ══════════════════════════════════════════
     LOGGING
     ══════════════════════════════════════════ */
  function log(message, type) {
    type = type || 'info';
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    const ts = new Date().toLocaleTimeString();
    entry.textContent = '[' + ts + '] ' + message;
    logBox.prepend(entry);
  }

  /* ══════════════════════════════════════════
     SERVER STATUS CHECK
     ══════════════════════════════════════════ */
  async function checkServerStatus() {
    try {
      const res = await fetch(ENDPOINTS.echoStatus);
      if (res.ok) {
        const data = await res.json();
        statusDot.classList.add('online');
        statusText.textContent = 'Server: ' + (data.status || 'OK') +
          ' — v' + (data.properties?.version || '?');
      } else {
        setOffline();
      }
    } catch (e) {
      setOffline();
    }
  }

  function setOffline() {
    statusDot.classList.remove('online');
    statusText.textContent = 'Server offline';
  }

  /* ══════════════════════════════════════════
     GUEST LOGIN — POST /api/auth/guest
     Server sets refreshToken + guestCookieToken
     as HttpOnly cookies in the response.
     Only accessToken comes back in the JSON body.
     ══════════════════════════════════════════ */
  window.guestLogin = async function () {
    btnGuestLogin.disabled = true;
    btnGuestLogin.innerHTML = '<span class="spinner"></span> Creating session...';
    loginError.innerHTML = '';

    try {
      const res = await fetch(ENDPOINTS.guestLogin, {
        method: 'POST',
        credentials: 'include',   // ← receive HttpOnly cookies
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Server returned ' + res.status);
      }

      const session = await res.json();
      saveSession(session);
      showSessionView(session);
      log('Guest session created: ' + session.username, 'success');
      log('refreshToken + guestCookieToken set as HttpOnly cookies (invisible to JS)', 'info');

    } catch (err) {
      loginError.innerHTML = '<div class="msg-error"><i class="fas fa-exclamation-triangle"></i> ' +
        escapeHtml(err.message) + '</div>';
    } finally {
      btnGuestLogin.disabled = false;
      btnGuestLogin.innerHTML = '<i class="fas fa-user-secret"></i>&nbsp; Enter as Guest';
    }
  };

  /* ══════════════════════════════════════════
     TOKEN REFRESH — POST /api/auth/refresh
     No body needed — the server reads the
     refreshToken from the HttpOnly cookie.
     ══════════════════════════════════════════ */
  window.refreshTokens = async function () {
    const stored = loadSession();
    if (!stored) {
      log('No session available', 'error');
      return;
    }

    log('Requesting token refresh (rotation) — cookie sent automatically...', 'info');

    try {
      const res = await fetch(ENDPOINTS.refresh, {
        method: 'POST',
        credentials: 'include'    // ← send + receive HttpOnly cookies
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) {
          log('Refresh token invalid/expired — session ended', 'error');
          clearSession();
          setTimeout(showLoginView, 1500);
          return;
        }
        throw new Error(err.message || 'Refresh failed: ' + res.status);
      }

      const data = await res.json();

      // Update stored session with new access token (refresh token is in cookie)
      const updated = Object.assign({}, stored, {
        accessToken:           data.accessToken,
        accessTokenExpiresAt:  data.accessTokenExpiresAt,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt
      });
      saveSession(updated);
      showSessionView(updated);

      log('Tokens refreshed successfully (rotation complete)', 'success');

    } catch (err) {
      log('Refresh error: ' + err.message, 'error');
    }
  };

  /* ══════════════════════════════════════════
     GET /api/auth/me — Protected endpoint
     ══════════════════════════════════════════ */
  window.getMe = async function () {
    const stored = loadSession();
    if (!stored || !stored.accessToken) {
      log('No access token available', 'error');
      return;
    }

    log('GET /api/auth/me ...', 'info');

    try {
      const res = await fetch(ENDPOINTS.me, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + stored.accessToken }
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        log('ME response: ' + JSON.stringify(data), 'success');
      } else {
        log('ME failed (' + res.status + '): ' + (data.error || data.message || 'Unknown'), 'error');
        if (res.status === 401) {
          log('Access token expired — try refreshing tokens', 'warn');
        }
      }
    } catch (err) {
      log('ME error: ' + err.message, 'error');
    }
  };

  /* ══════════════════════════════════════════
     TRY ADMIN ACCESS — GET /api/admin/guests
     Should return 403 for guests (no ADMIN role)
     ══════════════════════════════════════════ */
  window.tryAdminAccess = async function () {
    const stored = loadSession();
    if (!stored || !stored.accessToken) {
      log('No access token available', 'error');
      return;
    }

    log('Attempting admin access: GET /api/admin/guests ...', 'warn');

    try {
      const res = await fetch(ENDPOINTS.adminGuests, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + stored.accessToken }
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        log('Admin access GRANTED — you have ADMIN role', 'success');
      } else if (res.status === 403) {
        log('403 FORBIDDEN — Guest cannot access admin endpoints (expected)', 'warn');
      } else if (res.status === 401) {
        log('401 UNAUTHORIZED — Token invalid or expired', 'error');
      } else {
        log('Admin request failed (' + res.status + '): ' + (data.message || 'Unknown'), 'error');
      }
    } catch (err) {
      log('Admin access error: ' + err.message, 'error');
    }
  };

  /* ══════════════════════════════════════════
     LOGOUT — POST /api/auth/logout
     No body needed — server reads refreshToken
     from the HttpOnly cookie, then deletes both cookies.
     ══════════════════════════════════════════ */
  window.logoutSingle = async function () {
    const stored = loadSession();
    if (!stored) {
      clearSession();
      showLoginView();
      return;
    }

    log('Logging out (revoking single refresh token via cookie)...', 'info');

    try {
      const res = await fetch(ENDPOINTS.logout, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': 'Bearer ' + stored.accessToken
        }
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        log('Logout successful — token revoked, cookies cleared by server', 'success');
      } else {
        log('Logout response (' + res.status + '): ' + (data.message || 'Unknown'), 'warn');
      }
    } catch (err) {
      log('Logout error: ' + err.message, 'error');
    }

    clearSession();
    setTimeout(showLoginView, 1000);
  };

  /* ══════════════════════════════════════════
     LOGOUT ALL — POST /api/auth/logout/all
     Revokes all sessions for the user.
     Server deletes cookies in the response.
     ══════════════════════════════════════════ */
  window.logoutAll = async function () {
    const stored = loadSession();
    if (!stored || !stored.accessToken) {
      log('No access token available', 'error');
      clearSession();
      showLoginView();
      return;
    }

    log('Revoking ALL sessions for this user...', 'warn');

    try {
      const res = await fetch(ENDPOINTS.logoutAll, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': 'Bearer ' + stored.accessToken
        }
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        log('All sessions revoked successfully', 'success');
      } else {
        log('Logout-all response (' + res.status + '): ' + (data.message || 'Unknown'), 'warn');
      }
    } catch (err) {
      log('Logout-all error: ' + err.message, 'error');
    }

    clearSession();
    setTimeout(showLoginView, 1000);
  };

  /* ══════════════════════════════════════════
     VIEW TOGGLING
     ══════════════════════════════════════════ */
  function showSessionView(session) {
    loginView.style.display = 'none';
    sessionView.style.display = 'block';

    sessUsername.textContent    = session.username || '—';
    sessUuid.textContent       = session.userUuid || '—';
    sessRole.textContent       = session.role || 'PLAYER';
    sessAccessExp.textContent  = formatTimestamp(session.accessTokenExpiresAt);
    sessRefreshExp.textContent = formatTimestamp(session.refreshTokenExpiresAt);
    sessAccessToken.textContent  = session.accessToken || '—';
    sessRefreshToken.textContent = '(HttpOnly cookie — not accessible from JavaScript)';
  }

  function showLoginView() {
    sessionView.style.display = 'none';
    loginView.style.display = 'block';
    loginError.innerHTML = '';
  }

  /* ══════════════════════════════════════════
     LOCAL STORAGE (accessToken + metadata only)
     refreshToken is in HttpOnly cookie — not stored here.
     ══════════════════════════════════════════ */
  function saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      userUuid:             session.userUuid,
      username:             session.username,
      role:                 session.role,
      accessToken:          session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshTokenExpiresAt:session.refreshTokenExpiresAt
    }));
  }

  function loadSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (e) { return null; }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    // HttpOnly cookies are cleared by the server on logout responses
  }

  /* ══════════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════════ */
  function formatTimestamp(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleString();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ══════════════════════════════════════════
     RESUME SESSION VIA HttpOnly COOKIE
     Called when localStorage is empty but the
     guestCookieToken HttpOnly cookie may still
     exist.  We POST to /api/auth/guest/resume
     with credentials:'include' — the browser
     sends the HttpOnly cookie automatically.
     ══════════════════════════════════════════ */
  async function tryResumeFromCookie() {
    // Show a non-blocking "Resuming…" hint in the login card
    const resumeHint = document.getElementById('resumeHint');
    if (resumeHint) {
      resumeHint.style.display = 'block';
      resumeHint.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Attempting session resume…';
    }
    if (btnGuestLogin) btnGuestLogin.disabled = true;

    log('Attempting session resume via HttpOnly cookie…', 'info');

    try {
      const res = await fetch(ENDPOINTS.guestResume, {
        method: 'POST',
        credentials: 'include'    // ← browser sends HttpOnly cookie
      });

      if (!res.ok) {
        // Cookie is stale or missing
        log('No valid session cookie — please start a new session', 'warn');
        if (resumeHint) resumeHint.style.display = 'none';
        if (btnGuestLogin) btnGuestLogin.disabled = false;
        showLoginView();
        return;
      }

      const session = await res.json();
      saveSession(session);
      showSessionView(session);
      log('Session resumed from HttpOnly cookie', 'success');

    } catch (err) {
      log('Resume error: ' + err.message, 'error');
      if (resumeHint) resumeHint.style.display = 'none';
      if (btnGuestLogin) btnGuestLogin.disabled = false;
      showLoginView();
    }
  }

  /* ══════════════════════════════════════════
     INIT
     ══════════════════════════════════════════ */
  function init() {
    checkServerStatus();
    setInterval(checkServerStatus, 30000);

    const stored = loadSession();
    if (stored && stored.accessToken) {
      showSessionView(stored);
      log('Session restored from localStorage', 'info');
    } else {
      // localStorage is empty — try the HttpOnly cookie
      tryResumeFromCookie();
    }
  }

  init();

})();

/* =============================================
   PATHS GAMES — session-manager.js (v0.13.0)
   Session & Token Management — Step 13 concept
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

  const STORAGE_KEY      = 'paths_session_v013';
  const GUEST_COOKIE_NAME = 'pathsgames.guestcookie';
  const COOKIE_DAYS       = 30;   // matches guest session lifetime

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
     ══════════════════════════════════════════ */
  window.guestLogin = async function () {
    btnGuestLogin.disabled = true;
    btnGuestLogin.innerHTML = '<span class="spinner"></span> Creating session...';
    loginError.innerHTML = '';

    try {
      const res = await fetch(ENDPOINTS.guestLogin, {
        method: 'POST',
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
     Token rotation: old tokens revoked,
     brand-new access + refresh issued.
     ══════════════════════════════════════════ */
  window.refreshTokens = async function () {
    const stored = loadSession();
    if (!stored || !stored.refreshToken) {
      log('No refresh token available', 'error');
      return;
    }

    log('Requesting token refresh (rotation)...', 'info');

    try {
      const res = await fetch(ENDPOINTS.refresh, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored.refreshToken })
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

      // Update stored session with new tokens
      const updated = Object.assign({}, stored, {
        accessToken:           data.accessToken,
        refreshToken:          data.refreshToken,
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
     Revokes a single refresh token
     ══════════════════════════════════════════ */
  window.logoutSingle = async function () {
    const stored = loadSession();
    if (!stored || !stored.refreshToken) {
      log('No refresh token to revoke', 'error');
      clearSession();
      showLoginView();
      return;
    }

    log('Logging out (revoking single refresh token)...', 'info');

    try {
      const res = await fetch(ENDPOINTS.logout, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + stored.accessToken
        },
        body: JSON.stringify({ refreshToken: stored.refreshToken })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        log('Logout successful — token revoked', 'success');
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
     Revokes all sessions for the user
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
        headers: {
          'Content-Type': 'application/json',
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
    sessRefreshToken.textContent = session.refreshToken || '—';
  }

  function showLoginView() {
    sessionView.style.display = 'none';
    loginView.style.display = 'block';
    loginError.innerHTML = '';
  }

  /* ══════════════════════════════════════════
     COOKIE HELPERS
     ══════════════════════════════════════════ */
  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) +
      '; expires=' + expires + '; path=/; SameSite=Lax';
  }

  function getCookie(name) {
    const key = encodeURIComponent(name) + '=';
    for (const part of document.cookie.split(';')) {
      const t = part.trim();
      if (t.startsWith(key)) {
        return decodeURIComponent(t.slice(key.length));
      }
    }
    return null;
  }

  function deleteCookie(name) {
    document.cookie = encodeURIComponent(name) + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
  }

  /* ══════════════════════════════════════════
     LOCAL STORAGE + COOKIE
     ══════════════════════════════════════════ */
  function saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    // Persist the guestCookieToken in a long-lived cookie so the
    // session can be resumed even after the browser is fully closed.
    if (session.guestCookieToken) {
      setCookie(GUEST_COOKIE_NAME, session.guestCookieToken, COOKIE_DAYS);
    }
  }

  function loadSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (e) { return null; }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    deleteCookie(GUEST_COOKIE_NAME);
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
     RESUME SESSION VIA COOKIE
     Called when localStorage is empty but the
     'pathsgames.guestcookie' cookie still exists.
     ══════════════════════════════════════════ */
  async function tryResumeFromCookie() {
    const cookieToken = getCookie(GUEST_COOKIE_NAME);
    if (!cookieToken) {
      showLoginView();
      return;
    }

    // Show a non-blocking "Resuming…" hint in the login card
    const resumeHint = document.getElementById('resumeHint');
    if (resumeHint) {
      resumeHint.style.display = 'block';
      resumeHint.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resuming your session…';
    }
    if (btnGuestLogin) btnGuestLogin.disabled = true;

    log('Cookie detected — attempting session resume…', 'info');

    try {
      const res = await fetch(ENDPOINTS.guestResume, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestCookieToken: cookieToken })
      });

      if (!res.ok) {
        // Cookie is stale (session expired server-side)
        deleteCookie(GUEST_COOKIE_NAME);
        log('Saved session expired — please start a new one', 'warn');
        if (resumeHint) resumeHint.style.display = 'none';
        if (btnGuestLogin) btnGuestLogin.disabled = false;
        showLoginView();
        return;
      }

      const session = await res.json();
      saveSession(session);   // refreshes both localStorage and the cookie expiry
      showSessionView(session);
      log('Session resumed from cookie (' + GUEST_COOKIE_NAME + ')', 'success');

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
      // localStorage is empty (e.g. browser was closed): try the cookie
      tryResumeFromCookie();
    }
  }

  init();

})();

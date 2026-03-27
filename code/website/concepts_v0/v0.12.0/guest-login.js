/* =============================================
   PATHS GAMES — guest-login.js (v0.12.0)
   Guest Login frontend logic — Step 12 concept
   ============================================= */

(function () {
  'use strict';

  /* ══════════════════════════════════════════
     CONFIGURATION
     ══════════════════════════════════════════ */
  const API_BASE = 'http://localhost:8042';
  const ENDPOINTS = {
    guestLogin:   API_BASE + '/api/v1/auth/guest',
    guestResume:  API_BASE + '/api/v1/auth/guest/resume',
    echoStatus:   API_BASE + '/api/echo/status'
  };

  const STORAGE_KEY = 'paths_guest_session';

  /* ══════════════════════════════════════════
     DOM REFERENCES
     ══════════════════════════════════════════ */
  const loginView       = document.getElementById('loginView');
  const sessionView     = document.getElementById('sessionView');
  const btnGuestLogin   = document.getElementById('btnGuestLogin');
  const loginError      = document.getElementById('loginError');
  const statusDot       = document.getElementById('statusDot');
  const statusText      = document.getElementById('statusText');

  const sessUsername    = document.getElementById('sessUsername');
  const sessUuid        = document.getElementById('sessUuid');
  const sessAccessExp   = document.getElementById('sessAccessExp');
  const sessRefreshExp  = document.getElementById('sessRefreshExp');
  const sessAccessToken = document.getElementById('sessAccessToken');
  const sessRefreshToken= document.getElementById('sessRefreshToken');
  const sessionMsg      = document.getElementById('sessionMsg');

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
     GUEST LOGIN — POST /api/v1/auth/guest
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

      // Store session in localStorage
      saveSession(session);

      // Show session view
      showSessionView(session);

    } catch (err) {
      loginError.innerHTML = '<div class="msg-error"><i class="fas fa-exclamation-triangle"></i> ' +
        escapeHtml(err.message) + '</div>';
    } finally {
      btnGuestLogin.disabled = false;
      btnGuestLogin.innerHTML = '<i class="fas fa-user-secret"></i>&nbsp; Enter as Guest';
    }
  };

  /* ══════════════════════════════════════════
     RESUME SESSION — POST /api/v1/auth/guest/resume
     ══════════════════════════════════════════ */
  window.resumeSession = async function () {
    sessionMsg.innerHTML = '';

    const stored = loadSession();
    if (!stored || !stored.guestCookieToken) {
      sessionMsg.innerHTML = '<div class="msg-error">No session to resume</div>';
      return;
    }

    try {
      const res = await fetch(ENDPOINTS.guestResume, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestCookieToken: stored.guestCookieToken })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) {
          sessionMsg.innerHTML = '<div class="msg-error"><i class="fas fa-clock"></i> ' +
            'Session expired. Please create a new guest session.</div>';
          clearSession();
          setTimeout(() => showLoginView(), 2000);
          return;
        }
        throw new Error(err.message || 'Resume failed: ' + res.status);
      }

      const session = await res.json();
      saveSession(session);
      showSessionView(session);

      sessionMsg.innerHTML = '<div class="msg-info"><i class="fas fa-check"></i> Session resumed with new tokens</div>';
      setTimeout(() => { sessionMsg.innerHTML = ''; }, 3000);

    } catch (err) {
      sessionMsg.innerHTML = '<div class="msg-error"><i class="fas fa-exclamation-triangle"></i> ' +
        escapeHtml(err.message) + '</div>';
    }
  };

  /* ══════════════════════════════════════════
     LOGOUT
     ══════════════════════════════════════════ */
  window.logout = function () {
    clearSession();
    showLoginView();
  };

  /* ══════════════════════════════════════════
     VIEW TOGGLING
     ══════════════════════════════════════════ */
  function showSessionView(session) {
    loginView.style.display = 'none';
    sessionView.style.display = 'block';

    sessUsername.textContent    = session.username || '—';
    sessUuid.textContent       = session.userUuid || '—';
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
     LOCAL STORAGE
     ══════════════════════════════════════════ */
  function saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function loadSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /* ══════════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════════ */
  function formatTimestamp(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    return d.toLocaleString();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ══════════════════════════════════════════
     INIT — check for existing session on load
     ══════════════════════════════════════════ */
  function init() {
    checkServerStatus();

    // Auto-refresh server status every 30 seconds
    setInterval(checkServerStatus, 30000);

    // Check for existing session
    const stored = loadSession();
    if (stored && stored.guestCookieToken) {
      // Show session view with stored data, user can click "Resume" to get new tokens
      showSessionView(stored);
    } else {
      showLoginView();
    }
  }

  // Start
  init();

})();

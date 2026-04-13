/* =============================================
   PATHS GAMES — config.js (v0.14.2-stories-admin)
   Server configuration: local vs remote (AWS Lambda)

   Usage:
   - window.PG_API_BASE  → current base URL (updated on each switch)
   - window.PG_setServer('local' | 'remote') → switch + persist to localStorage
   ============================================= */

(function () {
  'use strict';

  const LOCAL_BASE  = 'http://localhost:8042';
  const REMOTE_BASE = 'https://<REMOTE_API>.execute-api.us-east-2.amazonaws.com/dev';
  const STORAGE_KEY = 'pg_server_mode';

  function getMode() {
    return localStorage.getItem(STORAGE_KEY) || 'local';
  }

  function applyMode(mode) {
    mode = (mode === 'remote') ? 'remote' : 'local';
    localStorage.setItem(STORAGE_KEY, mode);
    window.PG_API_BASE = (mode === 'remote') ? REMOTE_BASE : LOCAL_BASE;
    var sel = document.getElementById('serverModeSelect');
    if (sel) sel.value = mode;
    var lbl = document.getElementById('serverModeLabel');
    if (lbl) lbl.textContent = (mode === 'remote') ? 'AWS Lambda' : 'Local';
  }

  window.PG_setServer = function (mode) {
    applyMode(mode);
    // reload to re-initialise the page with the new base URL
    window.location.reload();
  };

  // Initialise before any other script runs
  window.PG_API_BASE = (getMode() === 'remote') ? REMOTE_BASE : LOCAL_BASE;

  document.addEventListener('DOMContentLoaded', function () {
    applyMode(getMode());
  });
})();

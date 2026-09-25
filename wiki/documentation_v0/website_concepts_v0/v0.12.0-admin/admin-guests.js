/* =============================================
   PATHS GAMES — admin-guests.js (v0.12.0-admin)
   Admin panel for guest user management
   ============================================= */

(function () {
  'use strict';

  /* ══════════════════════════════════════════
     CONFIGURATION
     ══════════════════════════════════════════ */
  const API_BASE = 'http://localhost:8042';
  const ENDPOINTS = {
    guests: API_BASE + '/api/admin/guests',
    guestStats: API_BASE + '/api/admin/guests/stats',
    guestExpired: API_BASE + '/api/admin/guests/expired',
    guestLogin: API_BASE + '/api/auth/guest',
    echoStatus: API_BASE + '/api/echo/status'
  };

  let currentModalUuid = null;

  /* ══════════════════════════════════════════
     DOM REFERENCES
     ══════════════════════════════════════════ */
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const statTotal = document.getElementById('statTotal');
  const statActive = document.getElementById('statActive');
  const statExpired = document.getElementById('statExpired');
  const guestTableBody = document.getElementById('guestTableBody');
  const notification = document.getElementById('notification');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalBody = document.getElementById('modalBody');

  /* ══════════════════════════════════════════
     INITIALIZATION
     ══════════════════════════════════════════ */
  checkServerStatus();
  window.loadData = loadData;
  window.cleanupExpired = cleanupExpired;
  window.createGuest = createGuest;
  window.viewGuest = viewGuest;
  window.deleteGuest = deleteGuest;
  window.closeModal = closeModal;
  window.deleteFromModal = deleteFromModal;

  loadData();

  /* ══════════════════════════════════════════
     SERVER STATUS
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
     LOAD DATA (stats + guest list)
     ══════════════════════════════════════════ */
  async function loadData() {
    await Promise.all([loadStats(), loadGuests()]);
  }

  async function loadStats() {
    try {
      const res = await fetch(ENDPOINTS.guestStats);
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      statTotal.textContent = data.totalGuests;
      statActive.textContent = data.activeGuests;
      statExpired.textContent = data.expiredGuests;
    } catch (e) {
      statTotal.textContent = '?';
      statActive.textContent = '?';
      statExpired.textContent = '?';
    }
  }

  async function loadGuests() {
    try {
      const res = await fetch(ENDPOINTS.guests);
      if (!res.ok) throw new Error('Failed to load guests');
      const guests = await res.json();
      renderGuestTable(guests);
    } catch (e) {
      guestTableBody.innerHTML =
        '<tr><td colspan="7" class="error-row"><i class="fas fa-exclamation-triangle"></i> ' +
        escapeHtml(e.message) + '</td></tr>';
    }
  }

  /* ══════════════════════════════════════════
     RENDER GUEST TABLE
     ══════════════════════════════════════════ */
  function renderGuestTable(guests) {
    if (guests.length === 0) {
      guestTableBody.innerHTML =
        '<tr><td colspan="7" class="empty-row"><i class="fas fa-ghost"></i> No guest users found</td></tr>';
      return;
    }

    guestTableBody.innerHTML = guests.map(g => {
      const statusClass = g.expired ? 'badge-expired' : 'badge-active';
      const statusLabel = g.expired ? 'Expired' : 'Active';
      return `
        <tr class="${g.expired ? 'row-expired' : ''}">
          <td class="col-username">${escapeHtml(g.username)}</td>
          <td class="col-uuid" title="${escapeHtml(g.userUuid)}">${shortUuid(g.userUuid)}</td>
          <td><span class="badge ${statusClass}">${statusLabel}</span></td>
          <td>${formatDate(g.tsRegistration)}</td>
          <td>${formatDate(g.tsLastAccess)}</td>
          <td>${formatDate(g.guestExpiresAt)}</td>
          <td class="col-actions">
            <button class="btn-icon btn-view" title="View details" onclick="viewGuest('${escapeHtml(g.userUuid)}')">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn-icon btn-del" title="Delete" onclick="deleteGuest('${escapeHtml(g.userUuid)}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>`;
    }).join('');
  }

  /* ══════════════════════════════════════════
     VIEW GUEST DETAIL (MODAL)
     ══════════════════════════════════════════ */
  async function viewGuest(uuid) {
    currentModalUuid = uuid;
    try {
      const res = await fetch(ENDPOINTS.guests + '/' + uuid);
      if (!res.ok) throw new Error('Guest not found');
      const g = await res.json();

      modalBody.innerHTML = `
        <ul class="detail-list">
          <li><span class="detail-label">Username</span><span class="detail-value">${escapeHtml(g.username)}</span></li>
          <li><span class="detail-label">UUID</span><span class="detail-value uuid">${escapeHtml(g.userUuid)}</span></li>
          <li><span class="detail-label">Nickname</span><span class="detail-value">${escapeHtml(g.nickname || '—')}</span></li>
          <li><span class="detail-label">Role</span><span class="detail-value">${escapeHtml(g.role)}</span></li>
          <li><span class="detail-label">State</span><span class="detail-value">${g.state}</span></li>
          <li><span class="detail-label">Language</span><span class="detail-value">${escapeHtml(g.language || '—')}</span></li>
          <li><span class="detail-label">Status</span><span class="detail-value">
            <span class="badge ${g.expired ? 'badge-expired' : 'badge-active'}">${g.expired ? 'Expired' : 'Active'}</span>
          </span></li>
          <li><span class="detail-label">Cookie Token</span><span class="detail-value uuid">${escapeHtml(g.guestCookieToken || '—')}</span></li>
          <li><span class="detail-label">Registered</span><span class="detail-value">${formatDate(g.tsRegistration)}</span></li>
          <li><span class="detail-label">Last Access</span><span class="detail-value">${formatDate(g.tsLastAccess)}</span></li>
          <li><span class="detail-label">Expires</span><span class="detail-value">${formatDate(g.guestExpiresAt)}</span></li>
        </ul>`;

      modalOverlay.style.display = 'flex';
    } catch (e) {
      showNotification('error', e.message);
    }
  }

  /* ══════════════════════════════════════════
     DELETE GUEST
     ══════════════════════════════════════════ */
  async function deleteGuest(uuid) {
    if (!confirm('Delete guest user ' + uuid.substring(0, 8) + '...?')) return;

    try {
      const res = await fetch(ENDPOINTS.guests + '/' + uuid, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showNotification('success', 'Guest deleted: ' + uuid.substring(0, 8) + '...');
      loadData();
    } catch (e) {
      showNotification('error', e.message);
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
    if (!confirm('Delete ALL expired guest sessions?')) return;

    try {
      const res = await fetch(ENDPOINTS.guestExpired, { method: 'DELETE' });
      if (!res.ok) throw new Error('Cleanup failed');
      const data = await res.json();
      showNotification('success', 'Cleaned up ' + data.deletedCount + ' expired guest(s)');
      loadData();
    } catch (e) {
      showNotification('error', e.message);
    }
  }

  /* ══════════════════════════════════════════
     CREATE GUEST (for testing)
     ══════════════════════════════════════════ */
  async function createGuest() {
    try {
      const res = await fetch(ENDPOINTS.guestLogin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Create failed');
      const data = await res.json();
      showNotification('success', 'Created guest: ' + data.username);
      loadData();
    } catch (e) {
      showNotification('error', e.message);
    }
  }

  /* ══════════════════════════════════════════
     MODAL MANAGEMENT
     ══════════════════════════════════════════ */
  function closeModal(event) {
    if (event && event.target !== modalOverlay) return;
    modalOverlay.style.display = 'none';
    currentModalUuid = null;
  }

  /* ══════════════════════════════════════════
     NOTIFICATIONS
     ══════════════════════════════════════════ */
  function showNotification(type, message) {
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
    notification.className = 'notification notif-' + type;
    notification.innerHTML = '<i class="fas ' + icon + '"></i> ' + escapeHtml(message);
    notification.style.display = 'block';
    setTimeout(() => { notification.style.display = 'none'; }, 4000);
  }

  /* ══════════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════════ */
  function formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString();
    } catch (e) {
      return isoStr;
    }
  }

  function shortUuid(uuid) {
    if (!uuid) return '—';
    return uuid.substring(0, 8) + '…';
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

})();

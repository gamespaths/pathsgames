/* Minimal consent + Google Tag Manager loader.
 *
 * The cookie banner and the stored choice are fully server-rendered (no JS),
 * so this file only has to react to an already-granted analytics consent:
 * it flips Google Consent Mode to "granted" and injects the GTM container.
 * Port of react-game src/consent/gtm.js, kept dependency-free.
 *
 * Globals set inline by base.html:
 *   window.PG_CONSENT  -> "", "necessary" or "all"
 *   window.PG_GTM_ID   -> GTM container id, or "" to disable.
 */
(function () {
  'use strict';

  function gtag() { window.dataLayer.push(arguments); }

  function loadGtm(id) {
    if (!id || window.__pgGtmLoaded) return;
    window.__pgGtmLoaded = true;
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0];
      var j = d.createElement(s);
      var dl = l !== 'dataLayer' ? '&l=' + l : '';
      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', id);
  }

  window.dataLayer = window.dataLayer || [];

  if (window.PG_CONSENT === 'all') {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
    loadGtm(window.PG_GTM_ID);
  }
})();

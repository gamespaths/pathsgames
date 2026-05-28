/* Paths Games — analytics bootstrap with Google Consent Mode v2.
 *
 * External (same-origin) so it satisfies a strict CSP without 'unsafe-inline'.
 * Order matters: consent defaults (everything denied) are set BEFORE the GTM
 * container loads, so Google tags write no cookies until the user accepts the
 * analytics category (see assets/cookieconsent-config.js → gtag('consent','update', …)). */
(function (w, d) {
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  // Load the Google Tag Manager container (tags stay denied until consent).
  (function (w, d, s, l, i) {
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var f = d.getElementsByTagName(s)[0],
        j = d.createElement(s),
        dl = l != 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
    f.parentNode.insertBefore(j, f);
  })(w, d, 'script', 'dataLayer', 'GTM-T52SH6JQ');
})(window, document);

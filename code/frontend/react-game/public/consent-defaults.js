// Google Consent Mode v2 defaults, loaded by index.html before GTM (src/consent/gtm.js).
// v0.41.0 — moved out of an inline script so the site CSP needs no 'unsafe-inline' for scripts.
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});

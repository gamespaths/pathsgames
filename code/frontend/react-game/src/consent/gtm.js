// Loads the Google Tag Manager container.
//
// Google Consent Mode v2 defaults are set inline in index.html *before* this
// runs, so Google tags (GA4, Ads) stay in the 'denied' state and set no
// tracking cookies until the user grants the analytics category via the cookie
// banner (see cookieConsent.js → gtag('consent','update', …)).
//
// Replaces the previous inline IIFE that ran with the literal `__GTM_ID__`
// placeholder at parse time and never received a real container id.
export function loadGtm(gtmId) {
  if (!gtmId || typeof document === 'undefined') return
  if (window.__pgGtmLoaded) return
  window.__pgGtmLoaded = true

  ;(function (w, d, s, l, i) {
    w[l] = w[l] || []
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
    const f = d.getElementsByTagName(s)[0]
    const j = d.createElement(s)
    const dl = l !== 'dataLayer' ? '&l=' + l : ''
    j.async = true
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl
    f.parentNode.insertBefore(j, f)
  })(window, document, 'script', 'dataLayer', gtmId)
}

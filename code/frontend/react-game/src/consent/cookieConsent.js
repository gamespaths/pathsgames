import * as CookieConsent from 'vanilla-cookieconsent'
import 'vanilla-cookieconsent/dist/cookieconsent.css'
import './cookieconsent-theme.css'

// Bump when the cookie policy materially changes — returning users are re-prompted.
const REVISION = 2

const TRANSLATIONS = {
  en: {
    consentModal: {
      title: 'We value your privacy',
      description:
        'We use cookies that are strictly necessary to keep your game session active, and — only with your consent — analytics cookies (Google Tag Manager) to understand how the game is used.',
      acceptAllBtn: 'Accept all',
      acceptNecessaryBtn: 'Reject all',
      showPreferencesBtn: 'Manage preferences',
    },
    preferencesModal: {
      title: 'Cookie preferences',
      acceptAllBtn: 'Accept all',
      acceptNecessaryBtn: 'Reject all',
      savePreferencesBtn: 'Save preferences',
      closeIconLabel: 'Close',
      sections: [
        {
          title: 'Strictly necessary cookies',
          description:
            'Required for the game to work — they keep your anonymous guest session active and protect the game from bots. They cannot be switched off.',
          linkedCategory: 'necessary',
          cookieTable: {
            headers: { name: 'Cookie', description: 'Purpose', expiration: 'Expiration' },
            body: [
              { name: 'pathsgames.guestcookie', description: 'Anonymous guest-resume identifier', expiration: '30 days' },
              { name: 'pathsgames.refreshToken', description: 'Session refresh token', expiration: '7 days' },
              { name: 'pathsgames.cookiesConsent', description: 'Stores your cookie choices', expiration: '6 months' },
              { name: 'pathsgames.turnstilePass', description: 'Remembers a recent Cloudflare Turnstile anti-bot pass (security)', expiration: '30 minutes' },
            ],
          },
        },
        {
          title: 'Analytics cookies',
          description:
            'Set by Google Tag Manager / Google Analytics to measure usage anonymously. Loaded only after you accept.',
          linkedCategory: 'analytics',
          cookieTable: {
            headers: { name: 'Cookie', description: 'Purpose', expiration: 'Expiration' },
            body: [
              { name: '_ga, _ga_*', description: 'Google Analytics usage measurement', expiration: 'up to 2 years' },
            ],
          },
        },
      ],
    },
  },
  it: {
    consentModal: {
      title: 'Teniamo alla tua privacy',
      description:
        'Usiamo cookie strettamente necessari per mantenere attiva la sessione di gioco e — solo con il tuo consenso — cookie analitici (Google Tag Manager) per capire come viene usato il gioco.',
      acceptAllBtn: 'Accetta tutti',
      acceptNecessaryBtn: 'Rifiuta tutti',
      showPreferencesBtn: 'Gestisci preferenze',
    },
    preferencesModal: {
      title: 'Preferenze cookie',
      acceptAllBtn: 'Accetta tutti',
      acceptNecessaryBtn: 'Rifiuta tutti',
      savePreferencesBtn: 'Salva preferenze',
      closeIconLabel: 'Chiudi',
      sections: [
        {
          title: 'Cookie strettamente necessari',
          description:
            'Indispensabili al funzionamento del gioco: mantengono attiva la tua sessione anonima e proteggono il gioco dai bot. Non possono essere disattivati.',
          linkedCategory: 'necessary',
          cookieTable: {
            headers: { name: 'Cookie', description: 'Finalità', expiration: 'Scadenza' },
            body: [
              { name: 'pathsgames.guestcookie', description: 'Identificatore di ripresa sessione anonima', expiration: '30 giorni' },
              { name: 'pathsgames.refreshToken', description: 'Token di refresh della sessione', expiration: '7 giorni' },
              { name: 'pathsgames.cookiesConsent', description: 'Memorizza le tue scelte sui cookie', expiration: '6 mesi' },
              { name: 'pathsgames.turnstilePass', description: 'Ricorda una recente verifica anti-bot Cloudflare Turnstile (sicurezza)', expiration: '30 minuti' },
            ],
          },
        },
        {
          title: 'Cookie analitici',
          description:
            'Impostati da Google Tag Manager / Google Analytics per misurare l’utilizzo in forma anonima. Caricati solo dopo la tua accettazione.',
          linkedCategory: 'analytics',
          cookieTable: {
            headers: { name: 'Cookie', description: 'Finalità', expiration: 'Scadenza' },
            body: [
              { name: '_ga, _ga_*', description: 'Misurazione utilizzo Google Analytics', expiration: 'fino a 2 anni' },
            ],
          },
        },
      ],
    },
  },
}

// GA sets cookies on the root registrable domain (e.g. .paths.games), even when
// the page runs on a subdomain (e.g. test.paths.games). The library's autoClear
// only tries the current hostname, so we compute the root domain and call
// eraseCookies explicitly whenever analytics consent is revoked.
function eraseGaCookies() {
  const parts = window.location.hostname.split('.')
  const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : window.location.hostname
  CookieConsent.eraseCookies([/^_ga/, /^_gid/], '/', rootDomain)
}

// Bridge the user's choice to Google Consent Mode v2.
function updateGtagConsent() {
  if (typeof window.gtag !== 'function') return
  const granted = CookieConsent.acceptedCategory('analytics')
  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: granted ? 'granted' : 'denied',
    ad_user_data: granted ? 'granted' : 'denied',
    ad_personalization: granted ? 'granted' : 'denied',
  })

  // When analytics is rejected, explicitly erase GA cookies from the root domain.
  if (!granted) eraseGaCookies()

  // Trigger a GTM event so tags mapped to this can fire immediately after consent.
  if (window.dataLayer) {
    window.dataLayer.push({ event: 'consent_update' })
  }
}

let started = false

export function initCookieConsent(lang = 'en') {
  if (started) return
  started = true

  CookieConsent.run({
    cookie: { name: 'pathsgames.cookiesConsent' },
    revision: REVISION,
    guiOptions: {
      consentModal: { layout: 'box', position: 'bottom right' },
      preferencesModal: { layout: 'box' },
    },
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: {
        autoClear: {
          // Covers cookies set directly on the current hostname.
          // Cookies set by GA on the root domain are handled by eraseGaCookies().
          cookies: [
            { name: /^_ga/ },
            { name: /^_gid/ },
          ]
        }
      },
    },
    language: {
      default: lang in TRANSLATIONS ? lang : 'en',
      autoDetect: 'document',
      translations: TRANSLATIONS,
    },
    onFirstConsent: updateGtagConsent,
    onConsent: updateGtagConsent,
    onChange: updateGtagConsent,
  })
}

export function openCookiePreferences() {
  CookieConsent.showPreferences()
}

export function setConsentLanguage(lang) {
  if (started && lang && lang in TRANSLATIONS) CookieConsent.setLanguage(lang)
}

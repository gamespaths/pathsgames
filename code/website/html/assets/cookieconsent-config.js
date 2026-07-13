/* Paths Games — first-party cookie consent (vanilla-cookieconsent v3, self-hosted).
 * Replaces the former CookieYes SaaS. Bridges the user's choice to Google
 * Consent Mode v2: Google Tag Manager / Analytics tags stay denied (defaults set
 * inline in index.html, before GTM) until the analytics category is accepted. */
(function () {
  // GA sets cookies on the root registrable domain (.paths.games) even from subdomains.
  // The library's autoClear only tries the current hostname, so compute root and erase explicitly.
  function eraseGaCookies() {
    var parts = window.location.hostname.split('.');
    var rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : window.location.hostname;
    window.CookieConsent.eraseCookies([/^_ga/, /^_gid/], '/', rootDomain);
  }

  function updateGtagConsent() {
    if (typeof window.gtag !== 'function') return;
    var granted = window.CookieConsent.acceptedCategory('analytics');
    window.gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied'
    });

    // When analytics is rejected, explicitly erase GA cookies from the root domain.
    if (!granted) eraseGaCookies();

    // Trigger a GTM event so tags can fire immediately after consent update.
    if (window.dataLayer) {
      window.dataLayer.push({ event: 'consent_update' });
    }
  }

  // "Cookie settings" control in the policy modal reopens the preferences (no
  // inline onclick, so the page works under a strict CSP).
  window.openCookiePreferences = function () {
    window.CookieConsent.showPreferences();
  };
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('pg-cookie-settings');
    if (btn) btn.addEventListener('click', window.openCookiePreferences);
  });

  window.CookieConsent.run({
    cookie: { name: 'pathsgames.cookiesConsent' },
    revision: 1,
    guiOptions: {
      consentModal: { layout: 'box', position: 'bottom right' },
      preferencesModal: { layout: 'box' }
    },
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: {
        autoClear: {
          // Covers cookies on current hostname; root-domain GA cookies handled by eraseGaCookies().
          cookies: [
            { name: /^_ga/ },
            { name: /^_gid/ }
          ]
        }
      }
    },
    language: {
      default: 'en',
      autoDetect: 'browser',
      translations: {
        en: {
          consentModal: {
            title: 'We value your privacy',
            description:
              'We use a strictly necessary cookie to remember your choices, and — only with your consent — analytics cookies to understand how this site is used.',
            acceptAllBtn: 'Accept all',
            //acceptNecessaryBtn: 'Reject all',
            showPreferencesBtn: 'Manage preferences'
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
                  'Required for the site to remember your cookie choices, and — when you play the game — to keep your anonymous session active. They cannot be switched off.',
                linkedCategory: 'necessary',
                cookieTable: {
                  headers: { name: 'Cookie', description: 'Purpose', expiration: 'Expiration' },
                  body: [
                    { name: 'pathsgames.cookiesConsent', description: 'Stores your cookie choices', expiration: '6 months' },
                    { name: 'pathsgames.guestcookie', description: 'Anonymous guest-resume identifier (set when playing the game)', expiration: '30 days' },
                    { name: 'pathsgames.refreshToken', description: 'Session refresh token (set when playing the game)', expiration: '7 days' }
                  ]
                }
              },
              {
                title: 'Analytics cookies',
                description:
                  'Set by Google Tag Manager / Google Analytics to measure usage anonymously. Loaded only after you accept.',
                linkedCategory: 'analytics',
                cookieTable: {
                  headers: { name: 'Cookie', description: 'Purpose', expiration: 'Expiration' },
                  body: [
                    { name: '_ga, _ga_*', description: 'Google Analytics usage measurement', expiration: 'up to 2 years' }
                  ]
                }
              }
            ]
          }
        },
        it: {
          consentModal: {
            title: 'Teniamo alla tua privacy',
            description:
              'Usiamo un cookie strettamente necessario per ricordare le tue scelte e — solo con il tuo consenso — cookie analitici per capire come viene usato questo sito.',
            acceptAllBtn: 'Accetta tutti',
            acceptNecessaryBtn: 'Rifiuta tutti',
            showPreferencesBtn: 'Gestisci preferenze'
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
                  'Necessari per ricordare le tue scelte sui cookie e — quando giochi — per mantenere attiva la tua sessione anonima. Non possono essere disattivati.',
                linkedCategory: 'necessary',
                cookieTable: {
                  headers: { name: 'Cookie', description: 'Finalità', expiration: 'Scadenza' },
                  body: [
                    { name: 'pathsgames.cookiesConsent', description: 'Memorizza le tue scelte sui cookie', expiration: '6 mesi' },
                    { name: 'pathsgames.guestcookie', description: 'Identificatore di ripresa sessione anonima (impostato giocando)', expiration: '30 giorni' },
                    { name: 'pathsgames.refreshToken', description: 'Token di refresh della sessione (impostato giocando)', expiration: '7 giorni' }
                  ]
                }
              },
              {
                title: 'Cookie analitici',
                description:
                  'Impostati da Google Tag Manager / Google Analytics per misurare l’utilizzo in forma anonima. Caricati solo dopo la tua accettazione.',
                linkedCategory: 'analytics',
                cookieTable: {
                  headers: { name: 'Cookie', description: 'Finalità', expiration: 'Scadenza' },
                  body: [
                    { name: '_ga, _ga_*', description: 'Misurazione utilizzo Google Analytics', expiration: 'fino a 2 anni' }
                  ]
                }
              }
            ]
          }
        }
      }
    },
    onFirstConsent: updateGtagConsent,
    onConsent: updateGtagConsent,
    onChange: updateGtagConsent
  });
})();

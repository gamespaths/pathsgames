/* =============================================
   PATHS GAMES — admin.js (v0.14.0-admin)
   Story admin panel: import, list & delete stories

   Requires ADMIN role.
   Access token in memory + localStorage.
   ============================================= */

(function () {
  'use strict';

  /* ══════════════════════════════════════════
     CONFIGURATION
     API_BASE is set by config.js (window.PG_API_BASE).
     Supports 'local' (http://localhost:8042) or 'remote'
     (AWS Lambda — configured in config.js).
     ══════════════════════════════════════════ */
  const API_BASE = window.PG_API_BASE || 'http://localhost:8042';
  const ENDPOINTS = {
    echo:          API_BASE + '/api/echo/status',
    me:            API_BASE + '/api/auth/me',
    storiesPublic: API_BASE + '/api/stories',
    storiesAdmin:  API_BASE + '/api/admin/stories',
    storyImport:   API_BASE + '/api/admin/stories/import'
  };

  /* ══════════════════════════════════════════
     STATE
     ══════════════════════════════════════════ */
  let accessToken = null;
  let currentLang = 'en';
  let pendingFileContent = null;

  const STORAGE_KEY = 'pg_story_admin_v1';

  /* ══════════════════════════════════════════
     SAMPLE STORY DATA
     ══════════════════════════════════════════ */
  /* ──────────────────────────────────────────
     Field reference (StoryImportService):
       Story root  → uuid, author, versionMin, versionMax, clockSingularDescription,
                      clockPluralDescription, linkCopyright, category, group,
                      visibility, priority, peghi, idTextTitle, idTextDescription
       texts[]     → idText (int), lang, shortText, longText, linkCopyright
       difficulties[] → idTextDescription, expCost, maxWeight, minCharacter,
                        maxCharacter, costHelpComa, costMaxCharacteristics,
                        numberMaxFreeAction
       classes[]   → idTextName, idTextDescription, weightMax, dexterityBase,
                     intelligenceBase, constitutionBase
       locations[] → idTextName, idTextDescription, isSafe (0/1),
                     costEnergyEnter, maxCharacters
       items[]     → idTextName, idTextDescription, weight, isConsumabile (0/1)
       events[]    → idTextName, idTextDescription, type (NORMAL|FIRST|AUTOMATIC),
                     costEnery, flagEndTime (0/1), characteristicToAdd,
                     characteristicToRemove, keyToAdd, keyValueToAdd
       choices[]   → idTextName, idTextDescription, priority, otherwiseFlag (0/1),
                     isProgress (0/1), logicOperator (AND|OR)
       creators[]  → link, url, urlImage
       cards[]     → awesomeIcon, styleMain, urlImage
       keys[]      → name, value, idTextDescription, group, priority, visibility
       traits[]    → idTextName, idTextDescription, costPositive, costNegative
       characterTemplates[] → idTextName, idTextDescription, lifeMax, energyMax,
                              sadMax, dexterityStart, intelligenceStart, constitutionStart
       weatherRules[] → idTextName, idTextDescription, probability,
                        costMoveSafeLocation, costMoveNotSafeLocation,
                        active (0/1), priority, deltaEnergy
       globalRandomEvents[] → conditionKey, conditionValue, probability
       missions[]  → conditionKey, conditionValueFrom, conditionValueTo,
                     idTextName, idTextDescription
     ────────────────────────────────────────── */
  const SAMPLE_STORY = {
    uuid:                     'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b',
    author:                   'PathsMaster',
    versionMin:               '0.14.0',
    clockSingularDescription: 'hour',
    clockPluralDescription:   'hours',
    linkCopyright:            'https://paths.games',
    category:                 'fantasy',
    group:                    'main',
    visibility:               'PUBLIC',
    priority:                 10,
    peghi:                    3,
    idTextTitle:              1,
    idTextDescription:        2,

    texts: [
      { idText: 1, lang: 'en', shortText: 'The Lost Kingdom',      longText: 'An ancient kingdom has fallen under a dark curse. Heroes must venture into the forgotten realm, uncover the truth, and restore the light before all is lost.' },
      { idText: 1, lang: 'it', shortText: 'Il Regno Perduto',      longText: 'Un antico regno è caduto sotto una maledizione oscura. Gli eroi devono avventurarsi nel reame dimenticato, svelare la verità e ripristinare la luce prima che tutto venga perduto.' },
      { idText: 2, lang: 'en', shortText: 'The Lost Kingdom',      longText: 'Explore three iconic locations, battle cursed creatures, and make choices that shape the fate of the realm.' },
      { idText: 2, lang: 'it', shortText: 'Il Regno Perduto',      longText: 'Esplora tre luoghi iconici, combatti creature maledette e fai scelte che plasmano il destino del reame.' },
      { idText: 100, lang: 'en', shortText: 'Castle Entrance',     longText: 'The imposing gates of the ruins. Crumbling stone and faded banners mark the once-proud threshold of the kingdom.' },
      { idText: 100, lang: 'it', shortText: 'Ingresso del Castello', longText: 'I cancelli imponenti delle rovine. Pietra sgretolata e stendardi sbiaditi segnano la soglia un tempo orgogliosa del regno.' },
      { idText: 101, lang: 'en', shortText: 'Throne Room',         longText: 'Shattered stained glass and a cracked throne dominate this once-magnificent hall. The curse radiates from the empty seat of power.' },
      { idText: 101, lang: 'it', shortText: 'Sala del Trono',      longText: 'Vetrate spezzate e un trono incrinato dominano questa sala un tempo magnifica. La maledizione emana dal seggio del potere vuoto.' },
      { idText: 102, lang: 'en', shortText: 'Dark Forest',         longText: 'Ancient trees twisted by dark magic surround the castle. Strange eyes watch from the shadows. Every path leads deeper into danger.' },
      { idText: 102, lang: 'it', shortText: 'Foresta Oscura',      longText: 'Alberi antichi contorti dalla magia oscura circondano il castello. Occhi strani osservano dalle ombre. Ogni sentiero porta più in profondità nel pericolo.' },
      { idText: 200, lang: 'en', shortText: 'Knight',              longText: 'A heavily armoured warrior of noble lineage. Excels in direct combat and inspiring allies.' },
      { idText: 200, lang: 'it', shortText: 'Cavaliere',           longText: 'Un guerriero pesantemente corazzato di nobili natali. Eccelle nel combattimento diretto e nell\'ispirare gli alleati.' },
      { idText: 201, lang: 'en', shortText: 'Mage',                longText: 'A scholar of the arcane arts. Fragile in body but devastating in magical ability.' },
      { idText: 201, lang: 'it', shortText: 'Mago',                longText: 'Uno studioso delle arti arcane. Fragile nel corpo ma devastante nella capacità magica.' },
      { idText: 202, lang: 'en', shortText: 'Rogue',               longText: 'A shadow who strikes from the dark. Nimble, cunning, and always one step ahead.' },
      { idText: 202, lang: 'it', shortText: 'Ladro',               longText: 'Un\'ombra che colpisce dal buio. Agile, astuto e sempre un passo avanti.' },
      { idText: 300, lang: 'en', shortText: 'Easy',                longText: 'For beginners — more resources, fewer dangers.' },
      { idText: 300, lang: 'it', shortText: 'Facile',              longText: 'Per i principianti — più risorse, meno pericoli.' },
      { idText: 301, lang: 'en', shortText: 'Normal',              longText: 'The standard experience. Balanced challenge and reward.' },
      { idText: 301, lang: 'it', shortText: 'Normale',             longText: 'L\'esperienza standard. Sfida e ricompensa bilanciate.' },
      { idText: 302, lang: 'en', shortText: 'Hard',                longText: 'For veterans — scarce resources, deadly encounters.' },
      { idText: 302, lang: 'it', shortText: 'Difficile',           longText: 'Per i veterani — risorse scarse, incontri mortali.' },
      { idText: 400, lang: 'en', shortText: 'Iron Sword',          longText: 'A well-balanced blade, reliable in any fight.' },
      { idText: 400, lang: 'it', shortText: 'Spada di Ferro',      longText: 'Una lama ben bilanciata, affidabile in qualsiasi combattimento.' },
      { idText: 401, lang: 'en', shortText: 'Health Potion',       longText: 'A glowing red vial. Restores vitality when you need it most.' },
      { idText: 401, lang: 'it', shortText: 'Pozione della Vita',  longText: 'Una fiala rossa luminosa. Ripristina la vitalità quando ne hai più bisogno.' },
      { idText: 402, lang: 'en', shortText: 'Torch',               longText: 'A simple wooden torch. Keeps the darkness at bay — for a while.' },
      { idText: 402, lang: 'it', shortText: 'Torcia',              longText: 'Una semplice torcia di legno. Tiene lontano il buio — per un po\'.' },
      { idText: 500, lang: 'en', shortText: 'Cursed Guardian',     longText: 'A stone statue animated by the curse blocks your path, sword arm raised!' },
      { idText: 500, lang: 'it', shortText: 'Guardiano Maledetto', longText: 'Una statua di pietra animata dalla maledizione blocca il tuo cammino, con il braccio armato alzato!' },
      { idText: 501, lang: 'en', shortText: 'Ancient Inscription', longText: 'You discover runes carved into the wall. They hold the secret of the curse\'s origin.' },
      { idText: 501, lang: 'it', shortText: 'Iscrizione Antica',   longText: 'Scopri rune scolpite nel muro. Nascondono il segreto dell\'origine della maledizione.' },
      { idText: 502, lang: 'en', shortText: 'The Curse Lifts',     longText: 'A blinding flash of light — and then silence. The dark magic unravels. The kingdom breathes again.' },
      { idText: 502, lang: 'it', shortText: 'La Maledizione si Dissolve', longText: 'Un lampo accecante — poi il silenzio. La magia oscura si dissolve. Il regno respira di nuovo.' },
      { idText: 600, lang: 'en', shortText: 'Fight the Guardian',  longText: 'Raise your weapon and engage the cursed statue in combat.' },
      { idText: 600, lang: 'it', shortText: 'Combatti il Guardiano', longText: 'Alza la tua arma e affronta la statua maledetta in combattimento.' },
      { idText: 601, lang: 'en', shortText: 'Decipher the Runes',  longText: 'Study the ancient inscription and try to understand its meaning.' },
      { idText: 601, lang: 'it', shortText: 'Decifra le Rune',     longText: 'Studia l\'iscrizione antica e cerca di capirne il significato.' },
      { idText: 602, lang: 'en', shortText: 'Perform the Ritual',  longText: 'Use the knowledge gained to perform the counter-curse ritual.' },
      { idText: 602, lang: 'it', shortText: 'Esegui il Rituale',   longText: 'Usa le conoscenze acquisite per eseguire il rituale anti-maledizione.' },
      { idText: 700, lang: 'en', shortText: 'Curse Resistance',    longText: 'Years of exposure to dark magic have hardened your spirit. Cursed effects are reduced.' },
      { idText: 700, lang: 'it', shortText: 'Resistenza alla Maledizione', longText: 'Anni di esposizione alla magia oscura hanno temprato il tuo spirito. Gli effetti delle maledizioni sono ridotti.' },
      { idText: 701, lang: 'en', shortText: 'Noble Blood',         longText: 'Your lineage grants authority over castle guards and local nobles.' },
      { idText: 701, lang: 'it', shortText: 'Sangue Nobile',       longText: 'Il tuo lignaggio ti conferisce autorità sulle guardie del castello e sui nobili locali.' },
      { idText: 702, lang: 'en', shortText: 'Arcane Sight',        longText: 'You can sense magical auras and detect hidden enchantments.' },
      { idText: 702, lang: 'it', shortText: 'Vista Arcana',        longText: 'Puoi percepire le aure magiche e rilevare incanti nascosti.' },
      { idText: 800, lang: 'en', shortText: 'Cursed Fog',          longText: 'A thick, unnatural fog rolls across the land. Visibility drops and movement costs increase.' },
      { idText: 800, lang: 'it', shortText: 'Nebbia Maledetta',    longText: 'Una densa nebbia innaturale si stende per la terra. La visibilità cala e i costi di movimento aumentano.' },
      { idText: 801, lang: 'en', shortText: 'Blood Rain',          longText: 'Red droplets fall from a cloudless sky. The curse is intensifying. Beware.' },
      { idText: 801, lang: 'it', shortText: 'Pioggia di Sangue',   longText: 'Gocce rosse cadono da un cielo senza nuvole. La maledizione si sta intensificando. Stai attento.' },
      { idText: 802, lang: 'en', shortText: 'Dawn Light',          longText: 'A rare burst of sunlight pierces the eternal gloom. Cursed creatures are weakened.' },
      { idText: 802, lang: 'it', shortText: 'Luce dell\'Alba',     longText: 'Un raro raggio di sole squarcia il buio eterno. Le creature maledette sono indebolite.' },
      { idText: 900, lang: 'en', shortText: 'Uncover the Origin',  longText: 'Find the source of the curse hidden somewhere in the castle ruins.' },
      { idText: 900, lang: 'it', shortText: 'Scopri l\'Origine',   longText: 'Trova la fonte della maledizione nascosta da qualche parte tra le rovine del castello.' },
      { idText: 901, lang: 'en', shortText: 'Break the Seal',      longText: 'Locate and destroy the magical seal binding the kingdom to its curse.' },
      { idText: 901, lang: 'it', shortText: 'Rompi il Sigillo',    longText: 'Localizza e distruggi il sigillo magico che lega il regno alla sua maledizione.' },
      { idText: 210, lang: 'en', shortText: 'Exiled Prince',       longText: 'Rightful heir to the throne, returned from exile to reclaim a kingdom you barely remember.' },
      { idText: 211, lang: 'en', shortText: 'Court Wizard',        longText: 'Last survivor of the royal court. Your magic is the kingdom\'s only hope.' },
      { idText: 212, lang: 'en', shortText: 'Cursed Knight',       longText: 'A royal guard spared by the curse for unknown reasons. You seek to free your companions.' },
      { idText: 950, lang: 'en', shortText: 'Throne Room Key',     longText: 'A heavy iron key that opens the sealed throne room doors.' },
      { idText: 951, lang: 'en', shortText: 'Seal Fragment',       longText: 'A shard of the magical seal. Collect all three to break the curse.' }
    ],

    difficulties: [
      { idTextDescription: 300, expCost: 3, maxWeight: 15, minCharacter: 1, maxCharacter: 4, costHelpComa: 2, costMaxCharacteristics: 2, numberMaxFreeAction: 2 },
      { idTextDescription: 301, expCost: 5, maxWeight: 10, minCharacter: 1, maxCharacter: 4, costHelpComa: 3, costMaxCharacteristics: 3, numberMaxFreeAction: 1 },
      { idTextDescription: 302, expCost: 8, maxWeight: 7,  minCharacter: 2, maxCharacter: 3, costHelpComa: 5, costMaxCharacteristics: 4, numberMaxFreeAction: 0 }
    ],

    classes: [
      { idTextName: 200, idTextDescription: 200, weightMax: 14, dexterityBase: 3, intelligenceBase: 1, constitutionBase: 4 },
      { idTextName: 201, idTextDescription: 201, weightMax: 6,  dexterityBase: 1, intelligenceBase: 5, constitutionBase: 1 },
      { idTextName: 202, idTextDescription: 202, weightMax: 8,  dexterityBase: 5, intelligenceBase: 2, constitutionBase: 2 }
    ],

    locations: [
      { idTextName: 100, idTextDescription: 100, isSafe: 1, costEnergyEnter: 0, maxCharacters: 10 },
      { idTextName: 101, idTextDescription: 101, isSafe: 0, costEnergyEnter: 2, maxCharacters: 6  },
      { idTextName: 102, idTextDescription: 102, isSafe: 0, costEnergyEnter: 1, maxCharacters: 8  }
    ],

    items: [
      { idTextName: 400, idTextDescription: 400, weight: 3, isConsumabile: 0 },
      { idTextName: 401, idTextDescription: 401, weight: 1, isConsumabile: 1 },
      { idTextName: 402, idTextDescription: 402, weight: 1, isConsumabile: 1 }
    ],

    events: [
      { idTextName: 500, idTextDescription: 500, type: 'NORMAL',    costEnery: 2, flagEndTime: 0 },
      { idTextName: 501, idTextDescription: 501, type: 'FIRST',     costEnery: 0, flagEndTime: 0 },
      { idTextName: 502, idTextDescription: 502, type: 'AUTOMATIC', costEnery: 0, flagEndTime: 1, keyToAdd: 'curse_status', keyValueToAdd: 'lifted' }
    ],

    choices: [
      { idTextName: 600, idTextDescription: 600, priority: 1, otherwiseFlag: 0, isProgress: 0, logicOperator: 'AND' },
      { idTextName: 601, idTextDescription: 601, priority: 2, otherwiseFlag: 0, isProgress: 1, logicOperator: 'AND' },
      { idTextName: 602, idTextDescription: 602, priority: 1, otherwiseFlag: 0, isProgress: 1, logicOperator: 'AND' }
    ],

    creators: [
      { link: 'PathsMaster', url: 'https://paths.games', urlImage: 'https://paths.games/assets/logo.png' }
    ],

    cards: [
      { awesomeIcon: 'fas fa-crown',  styleMain: 'fantasy' },
      { awesomeIcon: 'fas fa-dragon', styleMain: 'dark'    },
      { awesomeIcon: 'fas fa-magic',  styleMain: 'magic'   }
    ],

    keys: [
      { name: 'throne_key',      value: 'false', idTextDescription: 950, group: 'quest', priority: 1, visibility: 'PUBLIC' },
      { name: 'seal_fragments',  value: '0',     idTextDescription: 951, group: 'quest', priority: 2, visibility: 'PUBLIC' }
    ],

    traits: [
      { idTextName: 700, idTextDescription: 700, costPositive: 3, costNegative: 0 },
      { idTextName: 701, idTextDescription: 701, costPositive: 2, costNegative: 0 },
      { idTextName: 702, idTextDescription: 702, costPositive: 4, costNegative: 0 }
    ],

    characterTemplates: [
      { idTextName: 210, idTextDescription: 210, lifeMax: 12, energyMax: 10, sadMax: 8,  dexterityStart: 2, intelligenceStart: 2, constitutionStart: 4 },
      { idTextName: 211, idTextDescription: 211, lifeMax: 8,  energyMax: 12, sadMax: 6,  dexterityStart: 1, intelligenceStart: 5, constitutionStart: 1 },
      { idTextName: 212, idTextDescription: 212, lifeMax: 14, energyMax: 8,  sadMax: 10, dexterityStart: 4, intelligenceStart: 1, constitutionStart: 4 }
    ],

    weatherRules: [
      { idTextName: 800, idTextDescription: 800, probability: 25, costMoveSafeLocation: 0, costMoveNotSafeLocation: 1, active: 1, priority: 1, deltaEnergy: -1 },
      { idTextName: 801, idTextDescription: 801, probability: 15, costMoveSafeLocation: 0, costMoveNotSafeLocation: 2, active: 1, priority: 2, deltaEnergy: -2 },
      { idTextName: 802, idTextDescription: 802, probability: 10, costMoveSafeLocation: 0, costMoveNotSafeLocation: 0, active: 1, priority: 3, deltaEnergy:  1 }
    ],

    globalRandomEvents: [
      { conditionKey: null,           conditionValue: null,    probability: 15 },
      { conditionKey: 'curse_status', conditionValue: null,    probability: 30 },
      { conditionKey: 'time',         conditionValue: 'night', probability: 20 }
    ],

    missions: [
      { conditionKey: 'curse_origin',  conditionValueFrom: null, conditionValueTo: 'found',  idTextName: 900, idTextDescription: 900 },
      { conditionKey: 'curse_status',  conditionValueFrom: null, conditionValueTo: 'lifted',  idTextName: 901, idTextDescription: 901 }
    ]
  };

  /* ══════════════════════════════════════════
     DOM
     ══════════════════════════════════════════ */
  const loginScreen    = document.getElementById('loginScreen');
  const appScreen      = document.getElementById('appScreen');
  const tokenInput     = document.getElementById('tokenInput');
  const loginError     = document.getElementById('loginError');
  const loginStatusDot = document.getElementById('loginStatusDot');
  const loginStatusText= document.getElementById('loginStatusText');
  const appStatusDot   = document.getElementById('appStatusDot');
  const appStatusText  = document.getElementById('appStatusText');
  const langSelect     = document.getElementById('langSelect');
  const jsonInput      = document.getElementById('jsonInput');
  const importResult   = document.getElementById('importResult');
  const storyTableBody = document.getElementById('storyTableBody');
  const logArea        = document.getElementById('logArea');
  const notification   = document.getElementById('notification');
  const dropZone       = document.getElementById('dropZone');
  const fileName       = document.getElementById('fileName');

  /* ══════════════════════════════════════════
     EXPOSE TO HTML onclick
     ══════════════════════════════════════════ */
  window.loginWithToken = loginWithToken;
  window.doLogout       = doLogout;
  window.changeLang     = changeLang;
  window.switchTab      = switchTab;
  window.handleFile     = handleFile;
  window.importStory    = importStory;
  window.loadSample     = loadSample;
  window.clearImport    = clearImport;
  window.loadStories    = loadStories;
  window.deleteStory    = deleteStory;

  /* ══════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════ */
  (function init() {
    checkServerStatus();
    setupDragDrop();
    const saved = loadSavedSession();
    if (saved) {
      accessToken = saved.accessToken;
      validateAndEnter(accessToken);
    }
  })();

  /* ══════════════════════════════════════════
     SERVER STATUS
     ══════════════════════════════════════════ */
  async function checkServerStatus() {
    try {
      const res = await fetch(ENDPOINTS.echo);
      if (res.ok) {
        const data = await res.json();
        const ver = data.properties?.version || '?';
        setStatus(loginStatusDot, loginStatusText, true, 'Server OK — v' + ver);
        setStatus(appStatusDot,   appStatusText,   true, 'v' + ver);
      } else {
        throw new Error('HTTP ' + res.status);
      }
    } catch (e) {
      setStatus(loginStatusDot, loginStatusText, false, 'Server offline');
      setStatus(appStatusDot,   appStatusText,   false, 'Offline');
    }
  }

  function setStatus(dot, label, online, text) {
    if (!dot || !label) return;
    if (online) dot.classList.add('online');
    else dot.classList.remove('online');
    label.textContent = text;
  }

  /* ══════════════════════════════════════════
     LOGIN
     ══════════════════════════════════════════ */
  async function loginWithToken() {
    const raw = (tokenInput.value || '').trim();
    if (!raw) { showLoginError('Please paste your access token.'); return; }
    hideLoginError();
    document.getElementById('btnLogin').disabled = true;
    logEntry('inf', 'Verifying token…');

    try {
      const res = await fetch(ENDPOINTS.me, {
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + raw }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'HTTP ' + res.status);
      }
      const data = await res.json();
      if (data.role !== 'ADMIN') {
        throw new Error('ADMIN role required. Your role: ' + data.role);
      }

      accessToken = raw;
      saveSession();
      logEntry('ok', 'Authenticated as ' + data.username + ' [ADMIN]');
      enterDashboard();
    } catch (e) {
      logEntry('err', 'Login failed: ' + e.message);
      showLoginError(e.message);
    } finally {
      document.getElementById('btnLogin').disabled = false;
    }
  }

  async function validateAndEnter(token) {
    try {
      const res = await fetch(ENDPOINTS.me, {
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Token expired');
      const data = await res.json();
      logEntry('inf', 'Session restored: ' + data.username);
      enterDashboard();
    } catch (e) {
      clearSession();
      logEntry('err', 'Saved session invalid: ' + e.message);
    }
  }

  function enterDashboard() {
    loginScreen.style.display = 'none';
    appScreen.style.display   = 'flex';
    checkServerStatus();
    loadStories();
  }

  function doLogout() {
    clearSession();
    logEntry('inf', 'Logged out');
    appScreen.style.display   = 'none';
    loginScreen.style.display = 'flex';
    tokenInput.value = '';
    hideLoginError();
    checkServerStatus();
  }

  /* ══════════════════════════════════════════
     LANGUAGE CHANGE
     ══════════════════════════════════════════ */
  function changeLang() {
    currentLang = langSelect.value;
    loadStories();
  }

  /* ══════════════════════════════════════════
     IMPORT TABS
     ══════════════════════════════════════════ */
  function switchTab(tab) {
    document.getElementById('tabPaste').classList.toggle('active', tab === 'paste');
    document.getElementById('tabFile').classList.toggle('active', tab === 'file');
    document.getElementById('areaPaste').style.display = (tab === 'paste') ? 'block' : 'none';
    document.getElementById('areaFile').style.display  = (tab === 'file')  ? 'block' : 'none';
  }

  /* ══════════════════════════════════════════
     FILE UPLOAD / DRAG & DROP
     ══════════════════════════════════════════ */
  function setupDragDrop() {
    if (!dropZone) return;
    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', function () {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      var files = e.dataTransfer.files;
      if (files.length > 0) readFile(files[0]);
    });
  }

  function handleFile(event) {
    var files = event.target.files;
    if (files.length > 0) readFile(files[0]);
  }

  function readFile(file) {
    if (!file.name.endsWith('.json')) {
      showNotification('error', 'Please select a .json file');
      return;
    }
    fileName.textContent = file.name;
    var reader = new FileReader();
    reader.onload = function (e) {
      pendingFileContent = e.target.result;
      logEntry('inf', 'File loaded: ' + file.name + ' (' + file.size + ' bytes)');
    };
    reader.onerror = function () {
      showNotification('error', 'Failed to read file');
    };
    reader.readAsText(file);
  }

  /* ══════════════════════════════════════════
     IMPORT STORY — POST /api/admin/stories/import
     ══════════════════════════════════════════ */
  async function importStory() {
    var rawJson;
    var isPaste = document.getElementById('tabPaste').classList.contains('active');

    if (isPaste) {
      rawJson = (jsonInput.value || '').trim();
    } else {
      rawJson = pendingFileContent;
    }

    if (!rawJson) {
      showImportResult('error', '<i class="fas fa-exclamation-triangle"></i> No data to import. Paste JSON or upload a file.');
      return;
    }

    var data;
    try {
      data = JSON.parse(rawJson);
    } catch (e) {
      showImportResult('error', '<i class="fas fa-exclamation-triangle"></i> Invalid JSON: ' + escapeHtml(e.message));
      logEntry('err', 'JSON parse error: ' + e.message);
      return;
    }

    document.getElementById('btnImport').disabled = true;
    logEntry('inf', 'Importing story…');

    try {
      var res = await authFetch(ENDPOINTS.storyImport, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (!res) return;

      var resData = await res.json().catch(function () { return {}; });

      if (res.ok) {
        showImportResult('success',
          '<i class="fas fa-check-circle"></i> ' +
          'Story imported: <strong>' + escapeHtml(resData.storyUuid || '?') + '</strong>' +
          ' — Status: ' + escapeHtml(resData.status || '?') +
          ' — Entities: ' + (resData.entitiesImported || 0)
        );
        logEntry('ok', 'Story imported: ' + (resData.storyUuid || '?'));
        showNotification('success', 'Story imported successfully');
        loadStories();
      } else {
        showImportResult('error',
          '<i class="fas fa-exclamation-triangle"></i> ' +
          escapeHtml(resData.error || 'Import failed') + ': ' +
          escapeHtml(resData.message || 'HTTP ' + res.status)
        );
        logEntry('err', 'Import failed: ' + (resData.error || res.status));
      }
    } catch (e) {
      showImportResult('error', '<i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(e.message));
      logEntry('err', 'Import error: ' + e.message);
    } finally {
      document.getElementById('btnImport').disabled = false;
    }
  }

  function loadSample() {
    jsonInput.value = JSON.stringify(SAMPLE_STORY, null, 2);
    switchTab('paste');
    logEntry('inf', 'Sample story data loaded');
    showNotification('info', 'Sample data loaded — press Import');
  }

  function clearImport() {
    jsonInput.value = '';
    pendingFileContent = null;
    fileName.textContent = '';
    importResult.style.display = 'none';
    logEntry('inf', 'Import area cleared');
  }

  function showImportResult(type, html) {
    importResult.className = 'import-result ' + type;
    importResult.innerHTML = html;
    importResult.style.display = 'block';
  }

  /* ══════════════════════════════════════════
     LOAD STORIES — GET /api/admin/stories?lang=
     ══════════════════════════════════════════ */
  async function loadStories() {
    logEntry('inf', 'Loading stories (lang=' + currentLang + ')…');
    storyTableBody.innerHTML =
      '<tr><td colspan="7" class="loading-row">' +
      '<i class="fas fa-spinner fa-spin"></i> Loading…</td></tr>';

    try {
      var res = await authFetch(ENDPOINTS.storiesAdmin + '?lang=' + currentLang);
      if (!res) return;

      if (res.status === 403) {
        storyTableBody.innerHTML =
          '<tr><td colspan="7" class="error-row">' +
          '<i class="fas fa-ban"></i> 403 Forbidden — ADMIN role required</td></tr>';
        logEntry('err', 'Story list: 403 Forbidden');
        return;
      }

      if (!res.ok) throw new Error('HTTP ' + res.status);
      var stories = await res.json();
      renderStoryTable(stories);
      logEntry('ok', 'Loaded ' + stories.length + ' story(ies)');
    } catch (e) {
      storyTableBody.innerHTML =
        '<tr><td colspan="7" class="error-row">' +
        '<i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(e.message) + '</td></tr>';
      logEntry('err', 'Load error: ' + e.message);
    }
  }

  /* ══════════════════════════════════════════
     RENDER STORY TABLE
     ══════════════════════════════════════════ */
  function renderStoryTable(stories) {
    if (!stories || stories.length === 0) {
      storyTableBody.innerHTML =
        '<tr><td colspan="7" class="empty-row">' +
        '<i class="fas fa-ghost"></i> No stories found — import one above!</td></tr>';
      return;
    }

    storyTableBody.innerHTML = stories.map(function (s) {
      var vis = (s.visibility || 'unknown').toLowerCase();
      var badgeCls = vis === 'public' ? 'badge-public' : vis === 'private' ? 'badge-private' : 'badge-draft';
      var uuidShort = shortUuid(s.uuid);

      return (
        '<tr>' +
          '<td>' + escapeHtml(s.title || 'Untitled') + '</td>' +
          '<td>' + escapeHtml(s.author || '—') + '</td>' +
          '<td class="col-uuid" title="' + escapeHtml(s.uuid) + '" onclick="copyText(\'' + escapeHtml(s.uuid) + '\')">' + uuidShort + '</td>' +
          '<td><span class="badge ' + badgeCls + '">' + escapeHtml(s.visibility || '—') + '</span></td>' +
          '<td>' + escapeHtml(s.category || '—') + '</td>' +
          '<td>' + (s.priority != null ? s.priority : '—') + '</td>' +
          '<td class="col-actions">' +
            '<button class="btn-icon btn-del" title="Delete story" ' +
              'onclick="deleteStory(\'' + escapeHtml(s.uuid) + '\')">' +
              '<i class="fas fa-trash"></i>' +
            '</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
  }

  /* ══════════════════════════════════════════
     DELETE STORY — DELETE /api/admin/stories/{uuid}
     ══════════════════════════════════════════ */
  async function deleteStory(uuid) {
    if (!confirm('Delete story ' + uuid.substring(0, 8) + '…? This removes ALL related data.')) return;
    logEntry('inf', 'Deleting story ' + shortUuid(uuid) + '…');

    try {
      var res = await authFetch(ENDPOINTS.storiesAdmin + '/' + uuid, { method: 'DELETE' });
      if (!res) return;

      if (res.status === 403) {
        showNotification('error', '403 Forbidden — ADMIN role required');
        logEntry('err', 'Delete: 403 Forbidden');
        return;
      }
      if (res.status === 404) {
        showNotification('error', 'Story not found');
        logEntry('err', 'Delete: Story not found');
        return;
      }
      if (!res.ok) throw new Error('Delete failed: HTTP ' + res.status);

      showNotification('success', 'Story deleted: ' + shortUuid(uuid));
      logEntry('ok', 'Deleted story ' + shortUuid(uuid));
      loadStories();
    } catch (e) {
      showNotification('error', e.message);
      logEntry('err', 'Delete error: ' + e.message);
    }
  }

  /* ══════════════════════════════════════════
     AUTH FETCH
     ══════════════════════════════════════════ */
  async function authFetch(url, options) {
    var opts = options || {};
    opts.credentials = 'include';
    opts.headers = Object.assign(
      { 'Authorization': 'Bearer ' + accessToken },
      opts.headers || {}
    );
    if (opts.body && !opts.headers['Content-Type']) {
      opts.headers['Content-Type'] = 'application/json';
    }
    return fetch(url, opts);
  }

  /* ══════════════════════════════════════════
     SESSION PERSISTENCE
     ══════════════════════════════════════════ */
  function saveSession() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: accessToken }));
    } catch (_) {}
  }

  function loadSavedSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function clearSession() {
    accessToken = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  /* ══════════════════════════════════════════
     ACTIVITY LOG
     ══════════════════════════════════════════ */
  function logEntry(type, message) {
    var ts = new Date().toLocaleTimeString();
    var cls = type === 'ok' ? 'log-ok' : type === 'err' ? 'log-err' : 'log-inf';
    var icon = type === 'ok' ? '✓' : type === 'err' ? '✗' : '·';
    var line = document.createElement('div');
    line.innerHTML =
      '<span class="log-ts">' + ts + '</span>' +
      '<span class="' + cls + '">' + icon + ' ' + escapeHtml(message) + '</span>';
    logArea.appendChild(line);
    logArea.scrollTop = logArea.scrollHeight;
  }

  /* ══════════════════════════════════════════
     NOTIFICATIONS
     ══════════════════════════════════════════ */
  var notifTimer = null;
  function showNotification(type, message) {
    var icon = type === 'success' ? 'fa-check-circle' :
               type === 'error'   ? 'fa-exclamation-triangle' : 'fa-info-circle';
    notification.className = 'notification notif-' + type;
    notification.innerHTML = '<i class="fas ' + icon + '"></i> ' + escapeHtml(message);
    notification.style.display = 'block';
    if (notifTimer) clearTimeout(notifTimer);
    notifTimer = setTimeout(function () { notification.style.display = 'none'; }, 4000);
  }

  /* ══════════════════════════════════════════
     LOGIN UI
     ══════════════════════════════════════════ */
  function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
  }
  function hideLoginError() {
    loginError.style.display = 'none';
  }

  /* ══════════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════════ */
  function shortUuid(uuid) {
    if (!uuid) return '—';
    return uuid.substring(0, 8) + '…';
  }

  function escapeHtml(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  window.copyText = function (text) {
    navigator.clipboard.writeText(text)
      .then(function () { showNotification('success', 'Copied: ' + text.substring(0, 16) + '…'); })
      .catch(function () {});
  };

})();

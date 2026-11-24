/* Paths Games — v1.13.0 animation concepts: 1 deal, 2 play, 3 page turn, desktop and mobile.
   Plain browser JS, no build and no library: open index.html. */
(function () {
  'use strict';

  /* Base timings in ms at speed 1; the speed control divides them (speed 0.25 = 4× longer). */
  const BASE = {
    open: 650, deal: 620, dealStep: 110, lift: 240, fly: 560,
    discard: 320, discardStep: 50, flip: 900, simple: 520, sheet: 620,
  };
  const MAX_STAGGER = 8; // later cards land with the eighth: a long list never makes the player wait
  // Same query as react-game src/features/gameplay/js/mobileView.js (MOBILE_MQ).
  const MOBILE_MQ = '(max-width: 767px), (max-width: 991px) and (orientation: landscape) and (max-height: 500px)';

  /* A tiny story. Movement cards borrow icon and colours from the page they lead to;
     `back: true` turns the page the other way, `lock` returns the lock text or null,
     `place: true` puts the page on the map once visited. */
  const PAGES = {
    crossroads: {
      place: true, title: 'The Crossroads', icon: 'fa-map-signs', c1: '#8a5a2b', c2: '#1a0a02',
      desc: 'Four roads meet under a leaning signpost. The wind brings the smell of flour from the north and something darker from the east. In the middle of the square an old well waits, its rope still wet.',
      cards: [
        { title: 'Old Mill', type: 'Movement', cost: 2, to: 'mill' },
        { title: 'Dark Forest', type: 'Movement', cost: 3, to: 'forest' },
        { title: 'Search the well', type: 'Action', cost: 1, to: 'well', icon: 'fa-search',
          c1: '#3a5a78', c2: '#0b1622', effect: s => { s.hasKey = true; } },
        { title: 'Stone Tower', type: 'Movement', cost: 2, to: 'tower',
          lock: s => (s.hasKey ? null : 'Needs a key') },
      ],
    },
    mill: {
      place: true, title: 'The Old Mill', icon: 'fa-wind', c1: '#b07a3e', c2: '#2e1508',
      desc: 'The great wheel turns slowly in the stream. Flour dust dances in the light that comes through the broken boards, and somewhere inside a man is singing off-key.',
      cards: [
        { title: 'Crossroads', type: 'Movement', cost: 2, to: 'crossroads', back: true },
        { title: 'Talk to the miller', type: 'Choice', to: 'miller', icon: 'fa-comments' },
        { title: 'Rest by the wheel', type: 'Action', to: 'rest', icon: 'fa-bed' },
      ],
    },
    miller: {
      title: 'The Miller', icon: 'fa-user', c1: '#9a6f08', c2: '#2e1508',
      desc: '“The tower key? It fell into the well when I was a boy,” he laughs, wiping his hands on the apron. “Nobody has had the patience to look for it since.”',
      cards: [{ title: 'Old Mill', type: 'Movement', to: 'mill', back: true }],
    },
    rest: {
      title: 'By the Wheel', icon: 'fa-moon', c1: '#3b3a6b', c2: '#0d0b1e',
      desc: 'You sleep to the sound of water. When you wake, your legs feel light again and the sun is already high above the roof.',
      cards: [{ title: 'Wake up', type: 'Action', to: 'mill', back: true, icon: 'fa-sun',
        c1: '#c8960a', c2: '#5c3317' }],
    },
    forest: {
      place: true, title: 'The Dark Forest', icon: 'fa-tree', c1: '#2f5a2a', c2: '#0c1a08',
      desc: 'The trees close above you like the roof of a church. Between the trunks, small blue lights blink and move away whenever you look straight at them.',
      cards: [
        { title: 'Crossroads', type: 'Movement', cost: 3, to: 'crossroads', back: true },
        { title: 'Follow the lights', type: 'Choice', to: 'ring' },
        { title: 'Climb the oak', type: 'Action', icon: 'fa-leaf', c1: '#4f6b2a', c2: '#101a06',
          lock: () => 'Too tired' },
      ],
    },
    ring: {
      place: true, title: 'The Fairy Ring', icon: 'fa-hat-wizard', c1: '#4b3a8a', c2: '#0e0a24',
      desc: 'A circle of white mushrooms glows in a clearing. The lights gather above it and, for a moment, you hear music that no instrument is playing.',
      cards: [{ title: 'Dark Forest', type: 'Movement', to: 'forest', back: true }],
    },
    well: {
      place: true, title: 'The Well', icon: 'fa-water', c1: '#3a5a78', c2: '#0b1622',
      desc: 'You lower the bucket three times. On the third, something rings against the metal: an iron key, cold and covered in moss. The tower can be opened now.',
      cards: [{ title: 'Crossroads', type: 'Movement', to: 'crossroads', back: true }],
    },
    tower: {
      place: true, title: 'The Stone Tower', icon: 'fa-chess-rook', c1: '#6b5c4a', c2: '#1a140e',
      desc: 'The key turns with a groan and the door opens on a spiral staircase. The demo path ends here — in Paths Games, this is where the next page would begin.',
      cards: [{ title: 'Start again', type: 'Action', to: 'crossroads', back: true, icon: 'fa-redo',
        c1: '#7a4520', c2: '#1a0a02', effect: s => { s.hasKey = false; } }],
    },
  };

  /* The book's sections, in reading order: a tab on the right of the open one turns forward. */
  const TABS = [
    { id: 'board', label: 'Board', icon: 'fa-book-open' },
    { id: 'info', label: 'Info', icon: 'fa-info-circle' },
    { id: 'backpack', label: 'Backpack', icon: 'fa-suitcase' },
    { id: 'map', label: 'Map', icon: 'fa-map' },
    { id: 'missions', label: 'Missions', icon: 'fa-clipboard-list' },
  ];
  const DONE = { icon: 'fa-check-circle', text: 'Done' };
  const OPEN = { icon: 'fa-hourglass-half', text: 'In progress' };

  /* Each view is a spread: what the left page tells, the right page's heading and cards. */
  const VIEWS = {
    board: s => ({ left: PAGES[s.page], head: 'What will you do?', cards: PAGES[s.page].cards }),
    info: () => ({
      left: { title: 'Bran the Wanderer', icon: 'fa-user-shield', c1: '#7a4520', c2: '#1a0a02',
        desc: 'A traveller with good boots, a short temper and a long memory. The cards on the right are what is left of him today.' },
      head: 'Statistics',
      cards: [
        { title: 'Life', type: 'Stat', icon: 'fa-heart', c1: '#9b2c2c', c2: '#2a0808', note: { icon: 'fa-heart', text: '8 / 10' } },
        { title: 'Energy', type: 'Stat', icon: 'fa-bolt', c1: '#b8860b', c2: '#2e1a02', note: { icon: 'fa-bolt', text: '6 / 10' } },
        { title: 'Sadness', type: 'Stat', icon: 'fa-sad-tear', c1: '#3a5a78', c2: '#0b1622', note: { icon: 'fa-cloud-rain', text: '1 / 5' } },
        { title: 'Experience', type: 'Stat', icon: 'fa-star', c1: '#6b4fa0', c2: '#160d2a', note: { icon: 'fa-star', text: '3' } },
      ],
    }),
    backpack: s => ({
      left: { title: 'Backpack', icon: 'fa-suitcase', c1: '#8a5a2b', c2: '#1a0a02',
        desc: 'Everything you carry, wrapped in an old cloak. Using an item closes the backpack and brings you back to the board.' },
      head: 'Your items',
      cards: [
        s.items.bread && { title: 'Bread', type: 'Item', icon: 'fa-bread-slice', c1: '#c08040', c2: '#3a1d0b',
          label: 'Use', back: true, effect: st => { st.items.bread = false; } },
        { title: 'Torch', type: 'Item', icon: 'fa-fire', c1: '#d44a0a', c2: '#2a0a02', lock: () => 'Only in the dark' },
        s.hasKey && { title: 'Iron key', type: 'Item', icon: 'fa-key', c1: '#6b5c4a', c2: '#1a140e',
          note: { icon: 'fa-chess-rook', text: 'Opens the tower' } },
      ].filter(Boolean),
    }),
    map: s => ({
      left: { title: 'Map', icon: 'fa-map', c1: '#7a6a3a', c2: '#1a140a',
        desc: 'The places you have seen are drawn in ink; the rest is still fog. Pick one to travel there.' },
      head: 'Places you know',
      cards: Object.keys(PAGES).filter(id => PAGES[id].place && s.visited.has(id)).map(id => (id === s.page
        ? { title: PAGES[id].title, type: 'Location', to: id, note: { icon: 'fa-map-marker-alt', text: 'You are here' } }
        : { title: PAGES[id].title, type: 'Location', to: id })),
    }),
    missions: s => ({
      left: { title: 'Missions', icon: 'fa-clipboard-list', c1: '#5c3317', c2: '#1a0a02',
        desc: 'What the valley asked of you. A mission closes by itself when its last step is done.' },
      head: 'Your missions',
      cards: [
        { title: 'Find the key', type: 'Mission', icon: 'fa-key', c1: '#3a5a78', c2: '#0b1622',
          note: s.hasKey || s.visited.has('tower') ? DONE : OPEN },
        { title: 'Open the tower', type: 'Mission', icon: 'fa-chess-rook', c1: '#6b5c4a', c2: '#1a140e',
          note: s.visited.has('tower') ? DONE : OPEN },
        { title: 'Meet the fairies', type: 'Mission', icon: 'fa-hat-wizard', c1: '#4b3a8a', c2: '#0e0a24',
          note: s.visited.has('ring') ? DONE : OPEN },
      ],
    }),
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const isMobile = () => window.matchMedia(MOBILE_MQ).matches;
  const px = box => Object.fromEntries(['left', 'top', 'width', 'height'].map(k => [k, box[k] + 'px']));
  const DECK = '<div class="deck" aria-hidden="true"><span></span><span></span><span></span></div>';
  const SPINNER = '<i class="fas fa-spinner fa-spin"></i><span class="gc-footer__btn-label">Resolving…</span>';

  const els = {
    panel: $('#panel'), stage: $('#stage'), tabs: $('#tabs'), book: $('#book'),
    left: $('#page-left'), right: $('#page-right'),
  };
  const state = {
    view: 'board', page: 'crossroads', hasKey: false, items: { bread: true },
    visited: new Set(['crossroads']), busy: false, cards: [],
  };
  const fx = {};
  let T = {};
  let dealObserver = null;

  /* ── controls → fx flags, scaled timings, CSS variables ── */
  function readControls() {
    fx.deal = $('#fx-deal').checked;
    fx.faceDown = $('#fx-facedown').checked;
    fx.play = $('#fx-play').checked;
    fx.turn = $('#fx-turn').checked;
    fx.turnMode = $('#fx-turn-mode').value;
    fx.speed = Number($('#fx-speed').value);
    fx.latency = Number($('#fx-latency').value);
    fx.reduced = $('#fx-reduced').checked
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    T = {};
    const root = document.documentElement.style;
    for (const [key, ms] of Object.entries(BASE)) {
      T[key] = Math.round(ms / fx.speed);
      root.setProperty('--t-' + key, T[key] + 'ms');
    }
    document.body.classList.toggle('reduce-motion', fx.reduced);
    $('#fx-latency-out').textContent = fx.latency + ' ms';
    $('#fx-facedown').disabled = !fx.deal;
    $('#fx-turn-mode').disabled = !fx.turn;
  }
  const animated = flag => flag && !fx.reduced;

  /* ── rendering ── */
  function look(card) {
    const target = card.to ? PAGES[card.to] : {};
    return { icon: card.icon || target.icon, c1: card.c1 || target.c1, c2: card.c2 || target.c2 };
  }

  function cardHTML(card, i) {
    const lock = card.lock ? card.lock(state) : null;
    const { icon, c1, c2 } = look(card);
    const cost = card.cost ? `<span class="gc-cost"><i class="fas fa-bolt"></i>${card.cost}</span>` : '';
    const label = card.label || (card.type === 'Movement' || card.type === 'Location' ? 'Go' : 'Play');
    let footer;
    if (lock) footer = `<span class="gc-footer__note is-lock"><i class="fas fa-lock"></i> ${lock}</span>`;
    else if (card.note) footer = `<span class="gc-footer__note"><i class="fas ${card.note.icon}"></i> ${card.note.text}</span>`;
    else footer = `<button type="button" class="gc-footer__btn" data-play="${i}"><i class="fas fa-hand-pointer"></i>`
      + `<span class="gc-footer__btn-label">${label}</span></button>`;
    const classes = ['pg-card', lock ? 'is-locked' : '', animated(fx.deal) ? 'pre-deal' : '']
      .filter(Boolean).join(' ');
    return `<div class="${classes}" style="--i:${i}">
      <div class="face front">
        <div class="gc-title"><div class="gc-title__text">${card.title}</div>${cost}</div>
        <div class="gc-img" style="--c1:${c1};--c2:${c2}"><i class="fas ${icon}"></i>
          <span class="gc-type-badge">${card.type}</span></div>
        <div class="gc-footer">${footer}</div>
      </div>
      <div class="face back"><i class="fas fa-feather-alt"></i></div>
    </div>`;
  }

  function leftHTML(left) {
    return `<div class="loc-page">
      <h2 class="book-page-title">${left.title}</h2>
      <div class="loc-img" style="--c1:${left.c1};--c2:${left.c2}"><i class="fas ${left.icon}"></i></div>
      <div class="book-page-desc">${left.desc}</div>
    </div>`;
  }

  function rightHTML(spread, withCards) {
    const cols = 'cols-' + Math.min(Math.max(spread.cards.length, 1), 3);
    const cards = withCards ? spread.cards.map(cardHTML).join('') : '';
    return `<div class="right-head"><i class="fas fa-scroll"></i>${spread.head}</div>
      <div class="selection-list ${cols}">${cards}</div>`;
  }

  function renderTabs() {
    els.tabs.innerHTML = TABS.map(tab => {
      const active = tab.id === state.view;
      return `<button type="button" class="book-tab${active ? ' is-active' : ''}" data-tab="${tab.id}"`
        + ` aria-pressed="${active}"><i class="fas ${tab.icon}"></i><span>${tab.label}</span></button>`;
    }).join('');
  }

  const innerOf = pageEl => $('.page-inner', pageEl);
  const setLeft = spread => { innerOf(els.left).innerHTML = leftHTML(spread.left); };
  function setRight(spread) {
    stopDeal();
    state.cards = spread.cards;
    innerOf(els.right).innerHTML = rightHTML(spread, true);
  }
  const render = spread => { setLeft(spread); setRight(spread); };
  function setBusy(on) {
    state.busy = on;
    els.book.classList.toggle('is-busy', on);
  }
  function restartAnimation(el, className) {
    el.classList.remove(className);
    void el.offsetWidth; // reflow, so the same class plays again
    el.classList.add(className);
  }
  function shade() {
    const el = document.createElement('div');
    el.className = 'flip-shade';
    return el;
  }

  /* ═══ 1 — DEAL: each card leaves the deck when it enters the screen ═══ */
  // On mobile the cards often sit below the fold: they wait there, face-down on the deck,
  // and are dealt when the player scrolls to them. On desktop they are visible at once.
  function stopDeal() {
    if (dealObserver) dealObserver.disconnect();
    dealObserver = null;
  }

  function deal() {
    stopDeal();
    const cards = [...$('.selection-list', els.right).children];
    if (!animated(fx.deal)) {
      cards.forEach(c => c.classList.remove('pre-deal'));
      return;
    }
    const pending = cards.filter(c => c.classList.contains('pre-deal'));
    if (pending.length === 0) return;
    if (!('IntersectionObserver' in window)) {
      dealBatch(pending);
      return;
    }
    const io = new IntersectionObserver(entries => {
      const batch = entries.filter(e => e.isIntersecting).map(e => e.target)
        .sort((a, b) => cards.indexOf(a) - cards.indexOf(b));
      batch.forEach(c => io.unobserve(c));
      if (batch.length) dealBatch(batch);
    }, { root: isMobile() ? els.stage : null, threshold: 0.2 });
    pending.forEach(c => io.observe(c));
    dealObserver = io;
  }

  function dealBatch(batch) {
    const deck = $('.deck', els.right).getBoundingClientRect(); // sticky on mobile: read it now
    const deckX = deck.left + deck.width / 2;
    const deckY = deck.top + deck.height / 2;
    batch.forEach((card, n) => {
      const i = Math.min(n, MAX_STAGGER - 1);
      const r = card.getBoundingClientRect(); // the slot: pre-deal only hides it
      card.style.setProperty('--i', i);
      card.style.setProperty('--from-x', (deckX - (r.left + r.width / 2)) + 'px');
      card.style.setProperty('--from-y', (deckY - (r.top + r.height / 2)) + 'px');
      card.style.setProperty('--from-rot', (Math.random() * 30 - 15).toFixed(1) + 'deg');
      card.classList.remove('pre-deal');
      card.classList.add('is-dealing', fx.faceDown ? 'deal-facedown' : 'deal-flat');
      let landed = false;
      const land = () => {
        if (landed) return;
        landed = true;
        card.classList.remove('is-dealing', 'deal-facedown', 'deal-flat');
      };
      card.addEventListener('animationend', e => { if (e.target === card) land(); });
      setTimeout(land, T.deal + T.dealStep * i + 200); // a safety net if animationend never comes
    });
  }

  function redeal() {
    if (state.busy || !animated(fx.deal)) return;
    $('.selection-list', els.right).querySelectorAll('.pg-card').forEach(c => c.classList.add('pre-deal'));
    requestAnimationFrame(deal);
  }

  /* ═══ 2 — PLAY: lift + glow while the server answers, then fly into the story ═══ */
  // Desktop: into the left page's picture. Mobile: to the top of the screen, where the next
  // page will start once it has turned (the picture is usually scrolled away).
  function flightTarget() {
    if (!isMobile()) {
      const pic = $('.loc-img', els.left).getBoundingClientRect();
      return { x: pic.left + pic.width / 2, y: pic.top + pic.height / 2 };
    }
    const view = els.stage.getBoundingClientRect();
    const top = Math.max(view.top, els.tabs.getBoundingClientRect().bottom);
    return { x: view.left + view.width / 2, y: top + 60 };
  }

  function flyOut(cardEl) {
    const from = cardEl.getBoundingClientRect();
    const to = flightTarget();
    const clone = cardEl.cloneNode(true);
    clone.classList.remove('is-playing');
    clone.classList.add('flying-card');
    Object.assign(clone.style, px(from));
    clone.style.setProperty('--card-w', from.width + 'px');
    document.body.appendChild(clone);
    cardEl.style.visibility = 'hidden';
    const dx = to.x - (from.left + from.width / 2);
    const dy = to.y - (from.top + from.height / 2);
    const flight = clone.animate([
      { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 70}px) rotate(-10deg) scale(0.9)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) rotate(-16deg) scale(0.3)`, opacity: 0 },
    ], { duration: T.fly, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
    return flight.finished.then(() => clone.remove());
  }

  function discard(others) {
    others.forEach((el, j) => {
      el.style.setProperty('--j', j);
      el.style.setProperty('--drop-rot', (Math.random() * 10 - 5).toFixed(1) + 'deg');
      el.classList.add('is-discarded');
    });
    return others.length ? wait(T.discard + T.discardStep * others.length) : Promise.resolve();
  }

  async function play(index) {
    const card = state.cards[index];
    if (state.busy || !card) return;
    const cardEls = [...$('.selection-list', els.right).children];
    const el = cardEls[index];
    // a card still waiting on the deck stays there: it is turned away with the page
    const others = cardEls.filter(c => c !== el && !c.classList.contains('pre-deal'));
    stopDeal();
    setBusy(true);
    $('[data-play]', el).innerHTML = SPINNER;
    if (animated(fx.play)) {
      el.classList.add('is-playing');
      others.forEach(o => o.classList.add('is-dimmed'));
      await wait(Math.max(T.lift, fx.latency)); // the "server" call, hidden behind the glow
      if (card.effect) card.effect(state);
      await Promise.all([flyOut(el), discard(others)]);
    } else {
      await wait(fx.latency);
      if (card.effect) card.effect(state);
    }
    await go({ view: 'board', page: card.to || state.page }, card.back ? 'back' : 'fwd');
    setBusy(false);
    deal();
  }

  async function openTab(id) {
    if (state.busy || id === state.view) return;
    const from = TABS.findIndex(tab => tab.id === state.view);
    const to = TABS.findIndex(tab => tab.id === id);
    setBusy(true);
    await go({ view: id, page: state.page }, to > from ? 'fwd' : 'back');
    setBusy(false);
    deal();
  }

  /* ═══ 3 — PAGE TURN: every change of spread (location, tab, item used, map travel) ═══ */
  function go(next, dir) {
    state.view = next.view;
    state.page = next.page;
    if (next.view === 'board' && PAGES[next.page].place) state.visited.add(next.page);
    const spread = VIEWS[state.view](state);
    renderTabs();
    if (!animated(fx.turn)) {
      render(spread);
      if (isMobile()) els.stage.scrollTop = 0;
      return Promise.resolve();
    }
    if (fx.turnMode !== 'full') return simpleTurn(spread, dir);
    return isMobile() ? mobileTurn(spread, dir) : fullTurn(spread, dir);
  }

  async function simpleTurn(spread, dir) {
    const left = innerOf(els.left);
    const right = innerOf(els.right);
    const enter = dir === 'back' ? 'page-enter-back' : 'page-enter';
    if (isMobile()) els.stage.scrollTop = 0;
    render(spread);
    restartAnimation(left, 'page-fade');
    restartAnimation(right, enter);
    await wait(T.simple);
    left.classList.remove('page-fade');
    right.classList.remove(enter);
  }

  /* Desktop: a sheet hinged on the spine, the old page on its front, the new one on its back.
     Forward turns the right page over to the left; back turns the left page to the right. */
  async function fullTurn(spread, dir) {
    const fwd = dir !== 'back';
    const sheet = fwd ? els.right : els.left; // the page that lifts, also what it uncovers

    const front = sheet.cloneNode(true);
    front.removeAttribute('id');
    front.classList.add('flip-front');
    const back = document.createElement('section');
    back.className = 'book-page flip-back ' + (fwd ? 'book-page-left' : 'book-page-right');
    back.innerHTML = fwd
      ? `<div class="page-inner">${leftHTML(spread.left)}</div>`
      : `<div class="page-inner">${rightHTML(spread, false)}</div>${DECK}`;
    const frontShade = shade();
    const backShade = shade();
    front.appendChild(frontShade);
    back.appendChild(backShade);

    const flipper = document.createElement('div');
    flipper.className = 'page-flipper ' + (fwd ? 'is-fwd' : 'is-back');
    flipper.append(front, back);

    // same task as the append: no frame ever shows the new page uncovered
    if (fwd) setRight(spread); else setLeft(spread);
    const cast = document.createElement('div');
    cast.className = 'turn-shadow ' + (fwd ? 'from-left' : 'from-right');
    sheet.appendChild(cast);
    els.book.appendChild(flipper);

    const half = T.flip / 2;
    const turn = flipper.animate(
      [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${fwd ? -180 : 180}deg)` }],
      { duration: T.flip, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
    frontShade.animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: half, easing: 'ease-in', fill: 'forwards' });
    backShade.animate([{ opacity: 0.55 }, { opacity: 0 }], { delay: half, duration: half, easing: 'ease-out', fill: 'both' });
    cast.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: T.flip, easing: 'ease-out', fill: 'forwards' });

    await turn.finished;
    if (fwd) setLeft(spread); else setRight(spread);
    flipper.remove();
    cast.remove();
  }

  /* Mobile: one page only, hinged on its left edge. Only the part on screen is copied on a
     fixed sheet (a whole tall page would turn badly), and the jump back to the top of the new
     page happens under it, unseen. Forward: the old page lifts away to the left. Back: the
     new page comes in from the left over the old one. */
  function visibleSlice() {
    const view = els.stage.getBoundingClientRect();
    const book = els.book.getBoundingClientRect();
    const top = Math.max(view.top, book.top, els.tabs.getBoundingClientRect().bottom);
    const bottom = Math.min(view.bottom, book.bottom);
    return { left: book.left, top, width: book.width, height: Math.max(0, bottom - top), book };
  }

  function snapshot(slice) {
    const layer = document.createElement('div');
    layer.className = 'm-sheet';
    Object.assign(layer.style, px(slice));
    const copy = els.book.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    copy.classList.add('m-sheet__book');
    Object.assign(copy.style, { left: '0px', top: (slice.book.top - slice.top) + 'px', width: slice.book.width + 'px' });
    layer.appendChild(copy);
    return layer;
  }

  async function mobileTurn(spread, dir) {
    const fwd = dir !== 'back';
    const layers = [];
    const add = el => { document.body.appendChild(el); layers.push(el); return el; };
    const castOver = slice => {
      const c = document.createElement('div');
      c.className = 'm-cast';
      Object.assign(c.style, px(slice));
      return add(c);
    };
    const opts = { duration: T.sheet, fill: 'forwards' };
    els.stage.style.overflow = 'hidden'; // no scrolling under a turning page

    let turn;
    if (fwd) {
      const slice = visibleSlice();
      const sheet = snapshot(slice);
      const sheetShade = sheet.appendChild(shade());
      render(spread);
      els.stage.scrollTop = 0;
      const cast = castOver(slice);
      add(sheet);
      turn = sheet.animate([{ transform: 'perspective(1400px) rotateY(0deg)' },
        { transform: 'perspective(1400px) rotateY(-90deg)' }], { ...opts, easing: 'cubic-bezier(.55,.05,.85,.45)' });
      sheetShade.animate([{ opacity: 0 }, { opacity: 0.6 }], { ...opts, easing: 'ease-in' });
      cast.animate([{ opacity: 0.55 }, { opacity: 0 }], { ...opts, easing: 'ease-out' });
    } else {
      add(snapshot(visibleSlice())); // the old page stays still underneath
      render(spread);
      els.stage.scrollTop = 0;
      const slice = visibleSlice();
      const cast = castOver(slice);
      const sheet = add(snapshot(slice));
      const sheetShade = sheet.appendChild(shade());
      turn = sheet.animate([{ transform: 'perspective(1400px) rotateY(-90deg)' },
        { transform: 'perspective(1400px) rotateY(0deg)' }], { ...opts, easing: 'cubic-bezier(.15,.55,.45,.95)' });
      sheetShade.animate([{ opacity: 0.6 }, { opacity: 0 }], { ...opts, easing: 'ease-out' });
      cast.animate([{ opacity: 0 }, { opacity: 0.55 }], { ...opts, easing: 'ease-in' });
    }
    await turn.finished;
    layers.forEach(l => l.remove());
    els.stage.style.overflow = '';
  }

  /* ── buttons ── */
  async function restart() {
    if (state.busy) return;
    setBusy(true);
    Object.assign(state, { hasKey: false, items: { bread: true }, visited: new Set(['crossroads']) });
    await go({ view: 'board', page: 'crossroads' }, 'back');
    setBusy(false);
    deal();
  }

  function init() {
    readControls();
    ['fx-deal', 'fx-facedown', 'fx-play', 'fx-turn', 'fx-turn-mode', 'fx-speed', 'fx-latency', 'fx-reduced']
      .forEach(id => $('#' + id).addEventListener('input', () => {
        readControls();
        if (!state.busy) deal(); // a deal switched off shows the waiting cards at once
      }));
    $('#btn-redeal').addEventListener('click', redeal);
    $('#btn-restart').addEventListener('click', restart);
    $('#btn-panel').addEventListener('click', () => {
      const open = els.panel.classList.toggle('is-open');
      $('#btn-panel').setAttribute('aria-expanded', String(open));
    });
    els.tabs.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]');
      if (tab) openTab(tab.dataset.tab);
    });
    els.right.addEventListener('click', e => {
      const btn = e.target.closest('[data-play]');
      if (btn) play(Number(btn.dataset.play));
    });

    renderTabs();
    render(VIEWS.board(state));
    setTimeout(deal, fx.reduced ? 0 : T.open); // the book opens, then the first hand is dealt
  }

  init();
})();

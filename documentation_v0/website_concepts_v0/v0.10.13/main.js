/* =============================================
   PATHS GAMES — main.js
   Single-location navigation, 3D tilt, history
   ============================================= */
(function () {

  /* ══════════════════════════════════════════
     DATA — Locations
     ══════════════════════════════════════════ */
  const LOCATIONS = [
    {
      id: 'castle',
      title: 'Ironspire Castle',
      icon: 'fas fa-chess-rook',
      iconColor: null,
      emote: '🏰',
      image: null,
      desc: 'The ancient seat of the fallen king. Torchlight flickers in forgotten halls where echoes speak louder than the living.',
      choices: [
        { emote: '🕯️', icon: 'fas fa-code-branch', title: 'Enter the Dungeon',      desc: 'Descend into the castle depths.',  rotate: -9, ty: -4, target: 'dungeon'   },
        { emote: '⛰️', icon: 'fas fa-random',       title: 'Travel to Mountains',   desc: 'The cold peaks call.',            rotate:  9, ty: -4, target: 'mountains' }
      ]
    },
    {
      id: 'dungeon',
      title: 'Castle Dungeon',
      icon: 'fas fa-dungeon',
      iconColor: '#9a6f08',
      emote: '🗝️',
      image: null,
      desc: 'Dripping stone walls and rusted chains. Something moves in the shadows beyond the last torch.',
      choices: [
        { emote: '🏰', icon: 'fas fa-arrow-up',   title: 'Return Upstairs',    desc: 'Back to the castle hall.',  rotate: -9, ty: -4, target: 'castle' },
        { emote: '👻', icon: 'fas fa-ghost',      title: 'Follow the Shadow',  desc: 'Into the unknown dark.',    rotate:  9, ty: -4, target: null     }
      ]
    },
    {
      id: 'mountains',
      title: 'Frost Mountains',
      icon: 'fas fa-mountain',
      iconColor: null,
      emote: '⛰️',
      image: null,
      desc: 'Treacherous passes through eternal snow. The wind carries whispers of something ancient sleeping beneath the glacier.',
      choices: [
        { emote: '🏰', icon: 'fas fa-code-branch',     title: 'Back to Castle',     desc: 'Retreat to safer walls.',      rotate: -10, ty:  -2, target: 'castle'    },
        { emote: '🕳️', icon: 'fas fa-project-diagram', title: 'Enter the Cave',     desc: 'Descend into darkness.',       rotate:   0, ty: -18, behind: true, target: 'dragon'    },
        { emote: '🐺', icon: 'fas fa-paw',             title: 'Hunt the Wolves',    desc: 'Track beasts in the snow.',    rotate:  10, ty:  -2, target: 'wolf_camp' }
      ]
    },
    {
      id: 'wolf_camp',
      title: 'Wolf Territory',
      icon: 'fas fa-paw',
      iconColor: '#c08040',
      emote: '🐺',
      image: null,
      desc: 'A circle of bones and fresh tracks in the snow. The wolves are close — and they know you are here.',
      choices: [
        { emote: '⛰️', icon: 'fas fa-random',      title: 'Retreat to Mountains', desc: 'Live to fight another day.', rotate: -9, ty: -4, target: 'mountains' },
        { emote: '⚔️', icon: 'fas fa-fist-raised', title: 'Stand and Fight',      desc: 'Draw your blade.',          rotate:  9, ty: -4, target: null       }
      ]
    },
    {
      id: 'dragon',
      title: 'The Ember Abyss',
      icon: 'fas fa-dragon',
      iconColor: '#d44a0a',
      emote: '🐉',
      image: null,
      desc: 'The great dragon Vaelthorax rests here atop centuries of plunder. Every heartbeat shakes the stone.',
      choices: [
        { emote: '🗣️', icon: 'fas fa-project-diagram', title: 'Speak to the Dragon',   desc: 'Seek wisdom in flame.',     rotate: -10, ty:  -2, target: null        },
        { emote: '⚔️', icon: 'fas fa-code-branch',     title: 'Attack the Dragon',     desc: 'Steel against scales.',     rotate:   0, ty: -18, behind: true, target: null        },
        { emote: '⛰️', icon: 'fas fa-random',          title: 'Flee to the Mountains', desc: 'Run while you still can.',  rotate:  10, ty:  -2, target: 'mountains' }
      ]
    }
  ];

  const LOC_MAP = Object.fromEntries(LOCATIONS.map(l => [l.id, l]));

  /* ══════════════════════════════════════════
     NAVIGATION STATE
     ══════════════════════════════════════════ */
  let currentId = 'castle';
  let navHistory = [];

  /* ══════════════════════════════════════════
     MAGIC CODE GENERATOR
     ══════════════════════════════════════════ */
  const RUNES  = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛇᛈᛋᛏᛒᛖᛚᛞᛟᛠᛡᛣ';
  const HEX    = '0123456789abcdef';
  const GLYPHS = '†‡§¶♠♣♥♦★✶✷✻❁❖◆◊•×÷≈∞∴∵≡';

  function magicCode(len) {
    const pools = [RUNES, HEX, GLYPHS];
    const pool  = pools[Math.floor(Math.random() * pools.length)];
    let out = '';
    for (let i = 0; i < len; i++) {
      if (i > 0 && i % 4 === 0) out += ' ';
      out += pool[Math.floor(Math.random() * pool.length)];
    }
    return out;
  }

  /* ══════════════════════════════════════════
     RENDER — single location
     ══════════════════════════════════════════ */
  function renderLocation(id, direction) {
    console.log(renderLocation, { id, direction });
    const loc = LOC_MAP[id];
    if (!loc) { console.log("Location not found:", id); return; }

    const container = document.getElementById('world');
    if (!container) { console.log("Container not found: 'world'"); return; }

    const col = document.createElement('div');
    col.className = 'location-col center';

    const visualHTML = loc.image
      ? `<img src="${loc.image}" alt="${loc.title}" class="card-visual-img" />`
      : `<span class="card-visual-emote">${loc.emote}</span>`;

    const choicesHTML = loc.choices.map((ch, ci) => {
      const choiceVisual = ch.image
        ? `<img src="${ch.image}" alt="${ch.title}" class="choice-visual-img" />`
        : `<span class="choice-visual-emote">${ch.emote}</span>`;
      const choiceIcon = ch.icon || 'fas fa-code-branch';
      const rot = ch.rotate || 0;
      const ty  = ch.ty || 0;
      const behindCls  = ch.behind ? ' choice-behind' : '';
      const targetAttr = ch.target ? `data-target="${ch.target}"` : '';
      return `
        <div class="choice-card${behindCls}"
             data-rotate="${rot}" ${targetAttr}
             style="transform:rotate(${rot}deg) translateY(${ty}px);animation-delay:${0.2 + ci * 0.1}s">
          <div class="choice-title-plate">
            <span>${ch.title}</span>
            <i class="${choiceIcon} choice-plate-icon"></i>
          </div>
          <div class="choice-body-left">
            <div class="choice-visual">${choiceVisual}</div>
            <div class="choice-desc-area"><p>${ch.desc}</p></div>
          </div>
          <div class="choice-magic-footer">${magicCode(12)}</div>
        </div>`;
    }).join('');

    const backHTML = ''; /*navHistory.length > 0
      ? `<div class="location-back-row">
           <button class="location-back-btn" id="btn-back">
             <i class="fas fa-chevron-left me-1"></i>Go back
           </button>
         </div>`
      : '';*/

    col.innerHTML = `
      ${backHTML}
      <div class="location-card">
        <div class="card-title-plate">
          <span>${loc.title}</span>
          <i class="${loc.icon} card-plate-icon"${loc.iconColor ? ` style="color:${loc.iconColor}"` : ''}></i>
        </div>
        <div class="card-body-left">
          <div class="card-visual">${visualHTML}</div>
          <div class="card-desc-area"><p>${loc.desc}</p></div>
        </div>
        <div class="card-magic-footer">${magicCode(24)}</div>
      </div>
      <div class="choice-row choice-below">${choicesHTML}</div>`;

    if (container.children.length > 0 && direction) {
      const old      = container.children[0];
      const outClass = direction === 'back' ? 'slide-out-right' : 'slide-out-left';
      const inClass  = direction === 'back' ? 'slide-in-left'   : 'slide-in-right';
      col.classList.add(inClass);
      old.classList.add(outClass);
      old.addEventListener('animationend', () => {
        container.innerHTML = '';
        container.appendChild(col);
        requestAnimationFrame(() => col.classList.remove(inClass));
        bindEvents();
      }, { once: true });
    } else {
      container.innerHTML = '';
      container.appendChild(col);
      bindEvents();
    }
  }

  /* ══════════════════════════════════════════
     NAVIGATION
     ══════════════════════════════════════════ */
  function navigateTo(targetId) {
    navHistory.push(currentId);
    currentId = targetId;
    renderLocation(targetId, 'forward');
  }

  function navigateBack() {
    if (!navHistory.length) return;
    currentId = navHistory.pop();
    renderLocation(currentId, 'back');
  }

  /* ══════════════════════════════════════════
     BIND EVENTS after each render
     ══════════════════════════════════════════ */
  function bindEvents() {
    document.querySelectorAll('.choice-card').forEach(card => {
      card.addEventListener('click', () => {
        const target = card.dataset.target;
        if (target) {
          navigateTo(target);
        } else {
          const title = card.querySelector('.choice-title-plate span')?.textContent?.trim() || 'this path';
          showPopup(`✦ ${title}: this path is not yet forged… ✦`);
        }
      });
    });

    const btnBack = document.getElementById('btn-back');
    if (btnBack) btnBack.addEventListener('click', navigateBack);

    initCardTilt();
    initEntrance();
  }

  /* ══════════════════════════════════════════
     CARD 3D TILT
     ══════════════════════════════════════════ */
  function initCardTilt() {
    document.querySelectorAll('.location-card, .choice-card').forEach(card => {
      const isChoice   = card.classList.contains('choice-card');
      const baseRotate = parseFloat(card.dataset.rotate) || 0;

      card.addEventListener('mousemove', e => {
        const r  = card.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
        const dy = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
        const tz = isChoice ? 4 : 8;
        card.style.transform =
          `perspective(900px) rotateX(${-dy * 8}deg) rotateY(${dx * 8 + baseRotate}deg) translateY(-${tz}px) scale(1.04)`;
      });

      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ══════════════════════════════════════════
     CHOICE POPUP
     ══════════════════════════════════════════ */
  function showPopup(msg) {
    document.querySelectorAll('.choice-popup').forEach(el => el.remove());
    const div = document.createElement('div');
    div.className = 'choice-popup';
    div.textContent = msg;
    document.body.appendChild(div);
    div.addEventListener('animationend', () => div.remove());
  }

  /* ══════════════════════════════════════════
     CARD STAGGERED ENTRANCE
     ══════════════════════════════════════════ */
  function initEntrance() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const delay = (i * 0.1) + (parseFloat(entry.target.style.animationDelay) || 0);
          entry.target.style.animationDelay = `${delay}s`;
          entry.target.style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.location-card, .choice-card').forEach(card => {
      card.style.animationPlayState = 'paused';
      observer.observe(card);
    });
  }

  /* ══════════════════════════════════════════
     NAVBAR BADGE CAROUSEL
     ══════════════════════════════════════════ */
  function initBadgeCarousel() {
    const badges = document.querySelectorAll('.navbar-badges-to-rotate .navbar-badge');
    if (!badges.length) return;
    let current = 0;
    badges[0].classList.add('active');
    setInterval(() => {
      const prev = current;
      current = (current + 1) % badges.length;
      badges[prev].classList.remove('active');
      badges[prev].classList.add('exit-up');
      badges[current].classList.add('active');
      setTimeout(() => badges[prev].classList.remove('exit-up'), 500);
    }, 3000);
  }

  /* ── INIT ── */
  renderLocation(currentId);
  initBadgeCarousel();

})();

/* =============================================
   PATHS GAMES — main.js
   Data-driven card rendering, 3D tilt, popups
   ============================================= */
(function () {
  //'use strict';

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
      center: false,
      choices: [
        { emote: '🕯️', icon: 'fas fa-code-branch', title: 'Enter Castle', desc: 'Brave the iron gates.', rotate: -9, ty: -4 },
        { emote: '⛰️', icon: 'fas fa-random',       title: 'Travel', desc: 'The cold peaks call.', rotate: 9, ty: -4 }
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
      center: true,
      choices: [
        { emote: '🏰', icon: 'fas fa-code-branch',      title: 'Back to Castle', desc: 'Retreat to safer walls.', rotate: -10, ty: -2 },
        { emote: '🕳️', icon: 'fas fa-project-diagram',  title: 'Enter the Cave', desc: 'Descend into darkness.', rotate: 0, ty: -18, behind: true },
        { emote: '🐺', icon: 'fas fa-random',            title: 'Hunt Wolves', desc: 'Track beasts in the snow.', rotate: 10, ty: -2 }
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
      center: false,
      choices: [
        { emote: '🗣️', icon: 'fas fa-project-diagram', title: 'Scream', desc: 'Seek wisdom in flame.', rotate: -9, ty: -4 },
        { emote: '⚔️', icon: 'fas fa-code-branch',     title: 'Attack Dragon', desc: 'Steel against scales.', rotate: 9, ty: -4 }
      ]
    }
  ];

  /* ══════════════════════════════════════════
     MAGIC CODE GENERATOR
     ══════════════════════════════════════════ */
  const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛇᛈᛋᛏᛒᛖᛚᛞᛟᛠᛡᛣ';
  const HEX   = '0123456789abcdef';
  const GLYPHS = '†‡§¶♠♣♥♦★✶✷✻❁❖◆◊•×÷≈∞∴∵≡';

  function magicCode(len) {
    const pools = [RUNES, HEX, GLYPHS];
    let out = '';
    const pool = pools[Math.floor(Math.random() * pools.length)];
    for (let i = 0; i < len; i++) {
      if (i > 0 && i % 4 === 0) out += ' ';
      out += pool[Math.floor(Math.random() * pool.length)];
    }
    return out;
  }

  /* ══════════════════════════════════════════
     RENDER — Build world from data
     ══════════════════════════════════════════ */
  function renderWorld() {
    const container = document.getElementById('world');
    if (!container) return;
    container.innerHTML = '';

    LOCATIONS.forEach((loc, i) => {
      const col = document.createElement('div');
      col.className = `location-col${loc.center ? ' center' : ''}`;
      col.dataset.location = loc.id;
      col.style.animationDelay = `${0.05 + i * 0.05}s`;

      /* image or emote fallback */
      const visualHTML = loc.image
        ? `<img src="${loc.image}" alt="${loc.title}" class="card-visual-img" />`
        : `<span class="card-visual-emote">${loc.emote}</span>`;

      /* choice cards */
      const choicesHTML = loc.choices.map((ch, ci) => {
        const choiceVisual = ch.image
          ? `<img src="${ch.image}" alt="${ch.title}" class="choice-visual-img" />`
          : `<span class="choice-visual-emote">${ch.emote}</span>`;
        const choiceIcon = ch.icon || 'fas fa-code-branch';
        const rot = ch.rotate || 0;
        const ty  = ch.ty || 0;
        const behindCls = ch.behind ? ' choice-behind' : '';
        return `
          <div class="choice-card${behindCls}"
               data-rotate="${rot}"
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

      col.innerHTML = `
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

      container.appendChild(col);
    });

    /* re-init interactions on freshly rendered cards */
    initCardTilt();
    initChoicePopup();
    initEntrance();
  }

  /* ══════════════════════════════════════════
     CARD 3D TILT
     ══════════════════════════════════════════ */
  function initCardTilt() {
    document.querySelectorAll('.location-card, .choice-card').forEach(card => {
      const isChoice = card.classList.contains('choice-card');
      const baseRotate = parseFloat(card.dataset.rotate) || 0;

      card.addEventListener('mousemove', e => {
        const r  = card.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top  + r.height / 2;
        const dx = (e.clientX - cx) / (r.width  / 2);
        const dy = (e.clientY - cy) / (r.height / 2);
        const rotX = -dy * 8;
        const rotY =  dx * 8;
        const tz = isChoice ? 4 : 8;
        card.style.transform =
          `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY + baseRotate}deg) translateY(-${tz}px) scale(1.04)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ══════════════════════════════════════════
     CHOICE CARD CLICK POPUP
     ══════════════════════════════════════════ */
  function initChoicePopup() {
    document.querySelectorAll('.choice-card').forEach(card => {
      card.addEventListener('click', () => {
        const title =
          card.querySelector('.choice-title-plate span')?.textContent?.trim() || 'this path';
        showPopup(`✦ You chose: ${title} ✦`);
      });
    });
  }

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
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const delay =
            (i * 0.1) + (parseFloat(entry.target.style.animationDelay) || 0);
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

    // show first badge immediately
    badges[0].classList.add('active');

    setInterval(() => {
      const prev = current;
      current = (current + 1) % badges.length;

      // slide previous badge up and out
      badges[prev].classList.remove('active');
      badges[prev].classList.add('exit-up');

      // slide new badge in from below
      badges[current].classList.add('active');

      // after transition ends, reset the exited badge to below
      setTimeout(() => {
        badges[prev].classList.remove('exit-up');
        // reset to translateY(100%) via removing all state classes
      }, 500);
    }, 3000);
  }

  /* ── INIT ── */
  renderWorld();
  initBadgeCarousel();

})();

/* =============================================
   PATHS GAMES — main.js
   Story catalog, game bar, location navigator
   Stories and world data: stories.js
   ============================================= */
(function () {

  /* ══════════════════════════════════════════
     APP STATE
     ══════════════════════════════════════════ */
  // (story catalog and world data are in stories.js)
  let currentId    = null;
  let navHistory   = [];
  let activeStory  = null;

  /* DOM refs */
  const elCatalog   = document.getElementById('story-catalog');
  const elWorld     = document.getElementById('world');
  const elGameBar   = document.getElementById('game-bar');
  const elBarTitle  = document.getElementById('game-bar-title');
  const btnMap      = document.getElementById('btn-map');
  const btnJournal  = document.getElementById('btn-journal');
  const elCrowdfund = document.getElementById('crowdfund');

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
     STORY CATALOG — Netflix-style
     ══════════════════════════════════════════ */
  function renderCatalog() {
    /* Group stories by category */
    const cats = {};
    STORIES.forEach(s => {
      if (!cats[s.category]) cats[s.category] = [];
      cats[s.category].push(s);
    });

    let html = ''; //<h2 class="catalog-heading"><i class="fas fa-scroll me-2"></i>Choose Your Story</h2>';
    html += ''; //<p class="catalog-divider">— ✦ ⚜ ✦ —</p>';

    for (const [cat, stories] of Object.entries(cats)) {
      html += `<div class="catalog-category">`;
      html += `<h3 class="catalog-cat-title">${cat}</h3>`;
      html += `<div class="catalog-row">`;
      stories.forEach(s => {
        const playable = !!s.startLocation;
        const coverHTML = s.cover
          ? `<img src="${s.cover}" alt="${s.title}" class="catalog-card-img"/>`
          : `<span class="catalog-card-emote">${s.emote}</span>`;
        const btnClass  = playable ? 'catalog-play-btn' : 'catalog-play-btn catalog-play-btn-disabled';
        const btnLabel  = playable ? '<i class="fas fa-play me-1"></i>Play' : 'Coming soon'; //<i class="fas fa-lock me-1"></i>
        html += `
          <div class="catalog-card card-dimension-normal" data-story="${s.id}">
            <div class="catalog-title-plate">
              <span>${s.title}</span>
            </div>
            <div class="catalog-body">
              <div class="catalog-card-cover">${coverHTML}</div>
              <div class="catalog-desc-area"><p>${s.desc}</p></div>
            </div>
            <button class="${btnClass}" ${playable ? `data-story="${s.id}"` : 'disabled'}>${btnLabel}</button>
            <div class="catalog-magic-footer"><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
          </div>`;
      });
      html += `</div></div>`;
    }

    elCatalog.innerHTML = html;

    /* Bind play buttons */
    elCatalog.querySelectorAll('.catalog-play-btn:not(.catalog-play-btn-disabled)').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const storyId = btn.dataset.story;
        showStoryPreview(storyId);
      });
    });

    /* Horizontal drag-scroll for each row */
    elCatalog.querySelectorAll('.catalog-row').forEach(row => {
      let isDown = false, startX, scrollLeft;
      row.addEventListener('mousedown', e => { isDown = true; row.classList.add('grabbing'); startX = e.pageX - row.offsetLeft; scrollLeft = row.scrollLeft; });
      row.addEventListener('mouseleave', () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mouseup', () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mousemove', e => { if (!isDown) return; e.preventDefault(); row.scrollLeft = scrollLeft - (e.pageX - row.offsetLeft - startX) * 1.5; });
    });
  }

  /* ══════════════════════════════════════════
     STORY PREVIEW MODAL
     ══════════════════════════════════════════ */
  const PREVIEW_OPTIONS = [
    {
      id: 'difficult', title: 'Difficulty', icon: 'fas fa-skull',
      values: [
        { value: 'easy', label: 'Easy', icon: 'fas fa-child', active: true },
        { value: 'medium', label: 'Medium', icon: 'fas fa-user', disabled: true },
        { value: 'hard', label: 'Hard', icon: 'fas fa-user-ninja', disabled: true }
      ]
    },
    {
      id: 'character', title: 'Character', icon: 'fas fa-address-card',
      values: [
        { value: 'hero', label: 'Hero', icon: 'fas fa-shield-alt', active: true },
        { value: 'evil', label: 'Evil', icon: 'fas fa-ghost', disabled: true },
        { value: 'poor', label: 'Poor', icon: 'fas fa-coins', disabled: true }
      ]
    },
    {
      id: 'type', title: 'Type', icon: 'fas fa-users',
      values: [
        { value: 'single', label: 'Singleplayer', icon: 'fas fa-user', active: true },
        { value: 'multi', label: 'Multiplayer', icon: 'fas fa-user-friends', disabled: true },
        { value: 'open', label: 'Open World', icon: 'fas fa-globe', disabled: true }
      ]
    }
  ];

  let pendingStoryId = null;

  function showStoryPreview(storyId) {
    const story = STORIES.find(s => s.id === storyId);
    if (!story) return;
    pendingStoryId = storyId;

    /* Modal title */
    document.getElementById('preview-modal-title').textContent = story.title;

    /* Build body */
    const body = document.getElementById('story-preview-body');
    const coverHTML = story.cover
      ? `<img src="${story.cover}" alt="${story.title}" class="preview-visual-img" style="width:100%;height:100%;object-fit:cover;" />`
      : `<span class="preview-visual-emote">${story.emote}</span>`;

    let optionsHTML = '<div class="preview-options-list">';
    PREVIEW_OPTIONS.forEach(opt => {
      optionsHTML += `
        <div class="preview-option-group">
          <div class="preview-option-title"><i class="${opt.icon} me-1"></i> ${opt.title}</div>
          <div class="preview-option-values">
            ${opt.values.map(v => `
              <div class="preview-opt-btn ${v.active ? 'active' : ''} ${v.disabled ? 'disabled' : ''}">
                <i class="${v.icon} me-1"></i> <span>${v.label}</span>
                ${v.disabled ? '<i class="fas fa-lock option-lock"></i>' : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });
    optionsHTML += '</div>';

    const playable = !!story.startLocation;
    const actionHTML = `
      <div class="preview-action-block">
        <div class="action-row">
          <div class="action-info"><i class="fas fa-unlock-alt me-2"></i> Free to play</div>
          <button class="action-btn" id="btn-play-guest"><i class="fas fa-user-circle me-1"></i> Play as guest</button>
        </div>
        <div class="action-row">
          <div class="action-info"><i class="fas fa-file-signature me-2"></i> Terms</div>
          <a href="#" class="action-link" data-bs-toggle="modal" data-bs-target="#termsModal">Read conditions</a>
          <button class="action-btn btn-accept" id="btn-terms-accept">Accept</button>
        </div>
        <div class="action-row action-row-big">
          <div class="action-info"><i class="fas fa-dice-d20 me-2"></i> Paths Games</div>
          <button class="action-start-btn" id="btn-preview-start" disabled>
            ${playable ? '<i class="fas fa-play me-2"></i> Start' : 'Coming Soon'}
          </button>
        </div>
      </div>
    `;

    body.innerHTML = `
      <div class="story-preview-main card-dimension-large">
        <div class="preview-title-plate"><span>${story.title}</span></div>
        <div class="preview-visual">${coverHTML}</div>
        <div class="preview-desc"><p>${story.desc}</p><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
        <div class="preview-magic">${magicCode(24)}</div>
      </div>
      <div class="story-preview-right">
        ${optionsHTML}
        ${actionHTML}
      </div>`;

    /* Events for options & action block */
    const btnAccept = document.getElementById('btn-terms-accept');
    const btnStart = document.getElementById('btn-preview-start');
    const btnGuest = document.getElementById('btn-play-guest');

    if (btnAccept && btnStart) {
      btnAccept.addEventListener('click', () => {
        btnAccept.classList.add('accepted');
        btnAccept.innerHTML = '<i class="fas fa-check me-1"></i> Accepted';
        if (playable) {
          btnStart.disabled = false;
        }
      });
    }

    if (btnGuest) {
      btnGuest.addEventListener('click', () => {
        showPopup('✦ Continue as guest ✦');
      });
    }

    if (btnStart) {
      btnStart.addEventListener('click', () => {
        if (!pendingStoryId || !playable || btnStart.disabled) return;
        const bsModal = bootstrap.Modal.getInstance(document.getElementById('storyPreviewModal'));
        if (bsModal) bsModal.hide();
        startStory(pendingStoryId);
        pendingStoryId = null;
      });
    }

    /* Show modal via Bootstrap */
    const modal = new bootstrap.Modal(document.getElementById('storyPreviewModal'));
    modal.show();
  }

  /* Old Modal Play button - safe fallback */
  document.getElementById('btn-preview-play')?.addEventListener('click', () => {
    if (!pendingStoryId) return;
    const modal = bootstrap.Modal.getInstance(document.getElementById('storyPreviewModal'));
    if (modal) modal.hide();
    startStory(pendingStoryId);
    pendingStoryId = null;
  });

  /* ══════════════════════════════════════════
     START / STOP STORY
     ══════════════════════════════════════════ */
  function startStory(storyId) {
    const story = STORIES.find(s => s.id === storyId);
    if (!story || !story.startLocation) return;
    activeStory = story;
    currentId   = story.startLocation;
    navHistory  = [];

    /* Switch UI */
    elCatalog.style.display = 'none';
    elWorld.style.display   = '';
    elGameBar.style.display = '';
    elCrowdfund.style.display = 'none';
    elBarTitle.textContent  = story.title;

    renderLocation(currentId);
  }

  function stopStory() {
    activeStory = null;
    currentId   = null;
    navHistory  = [];

    Array.from(elWorld.children).forEach(c => { if (c.id !== 'player-bar') c.remove(); });
    elWorld.style.display   = 'none';
    elCrowdfund.style.display = '';
    elGameBar.style.display = 'none';
    elCatalog.style.display = '';
  }

  /* ══════════════════════════════════════════
     RENDER — single location
     ══════════════════════════════════════════ */
  function renderLocation(id, direction) {
    if (!activeStory) return;
    const locMap = STORIES_LOCATIONS[activeStory.id] || {};
    const loc    = locMap[id];
    if (!loc) return;
    currentId = id;

    /* ── Active location card (left panel) ── */
    const visualHTML = loc.image
      ? `<img src="${loc.image}" alt="${loc.title}" class="card-visual-img" />`
      : `<span class="card-visual-emote">${loc.emote}</span>`;

    const locationCardHTML = `
      <div class="location-card card-dimension-large">
        <div class="card-title-plate">
          <span>${loc.title}</span>
          <i class="${loc.icon} card-plate-icon"${ loc.iconColor ? ` style="color:${loc.iconColor}"` : ''}></i>
        </div>
        <div class="card-body-left">
          <div class="card-visual">${visualHTML}</div>
          <div class="card-desc-area"><p>${loc.desc}</p><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
        </div>
        <div class="card-magic-footer"><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
      </div>`;

    /* ── Neighbor (go) cards — Row 1 ── */
    const goCardsHTML = (loc.neighbors || []).map(nid => {
      const n = locMap[nid];
      if (!n) return '';
      return `
        <div class="choice-card go-card card-dimension-normal" data-target="${n.id}">
          <div class="choice-title-plate">
            <span>${n.title}</span>
            <i class="${n.icon} choice-plate-icon"${ n.iconColor ? ` style="color:${n.iconColor}"` : ''}></i>
          </div>
          <div class="choice-body-left">
            <div class="choice-visual"><span class="choice-visual-emote">${n.emote}</span></div>
            <div class="choice-desc-area"><p>${n.desc}</p></div>
          </div>
          <div class="choice-magic-footer"><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
        </div>`;
    }).join('');

    /* ── Action cards — Row 2 ── */
    const actionCardsHTML = (loc.actions || []).map(a => `
      <div class="choice-card action-card card-dimension-normal" data-action="${a.id}">
        <div class="choice-title-plate">
          <span>${a.title}</span>
          <i class="${a.icon} choice-plate-icon"></i>
        </div>
        <div class="choice-body-left">
          <div class="choice-visual"><span class="choice-visual-emote">${a.emote}</span></div>
          <div class="choice-desc-area"><p>${a.desc}</p></div>
        </div>
        <div class="choice-magic-footer"><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
      </div>`).join('');

    /* ── Build full scene ── */
    const scene = document.createElement('div');
    scene.className = 'game-scene';
    scene.innerHTML = `
      <div class="game-location-panel">${locationCardHTML}</div>
      <div class="game-right-panel">
        <div class="game-row">
          <h3 class="game-row-title"><i class="fas fa-compass me-2"></i>Nearby Locations</h3>
          <div class="game-row-scroll go-cards-scroll">${goCardsHTML || '<span class="game-row-empty">No paths lead further.</span>'}</div>
        </div>
        <div class="game-row">
          <h3 class="game-row-title"><i class="fas fa-scroll me-2"></i>Available Actions</h3>
          <div class="game-row-scroll action-cards-scroll">${actionCardsHTML || '<span class="game-row-empty">Nothing to do here.</span>'}</div>
        </div>
      </div>`;

    const container = elWorld;
    if (container.children.length > 0 && direction) {
      const old      = container.children[0];
      const outClass = direction === 'back' ? 'slide-out-right' : 'slide-out-left';
      const inClass  = direction === 'back' ? 'slide-in-left'   : 'slide-in-right';
      scene.classList.add(inClass);
      old.classList.add(outClass);
      old.addEventListener('animationend', () => {
        const elPlayerBar = document.getElementById('player-bar');
        Array.from(container.children).forEach(c => { if (c.id !== 'player-bar') c.remove(); });
        if (elPlayerBar) container.insertBefore(scene, elPlayerBar);
        else container.appendChild(scene);
        requestAnimationFrame(() => scene.classList.remove(inClass));
        bindGameEvents();
      }, { once: true });
    } else {
      const elPlayerBar = document.getElementById('player-bar');
      Array.from(container.children).forEach(c => { if (c.id !== 'player-bar') c.remove(); });
      if (elPlayerBar) container.insertBefore(scene, elPlayerBar);
      else container.appendChild(scene);
      bindGameEvents();
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
     BIND GAME EVENTS after each render
     ══════════════════════════════════════════ */
  function bindGameEvents() {
    /* Go-cards: show card detail modal, confirm → navigate */
    document.querySelectorAll('.go-card[data-target]').forEach(card => {
      card.addEventListener('click', () => {
        const locMap = STORIES_LOCATIONS[activeStory?.id] || {};
        const n = locMap[card.dataset.target];
        if (!n) return;
        showCardModal(n, 'go', card.dataset.target);
      });
    });

    /* Action-cards: show card detail modal, confirm → action */
    document.querySelectorAll('.action-card[data-action]').forEach(card => {
      card.addEventListener('click', () => {
        const locMap = STORIES_LOCATIONS[activeStory?.id] || {};
        const loc    = locMap[currentId];
        const action = (loc?.actions || []).find(a => a.id === card.dataset.action);
        if (!action) return;
        showCardModal(action, 'action', card.dataset.action);
      });
    });

    /* Horizontal drag-scroll for each game row */
    document.querySelectorAll('.game-row-scroll').forEach(row => {
      let isDown = false, startX, scrollLeft;
      row.addEventListener('mousedown', e => { isDown = true; row.classList.add('grabbing'); startX = e.pageX - row.offsetLeft; scrollLeft = row.scrollLeft; });
      row.addEventListener('mouseleave', () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mouseup',    () => { isDown = false; row.classList.remove('grabbing'); });
      row.addEventListener('mousemove',  e => { if (!isDown) return; e.preventDefault(); row.scrollLeft = scrollLeft - (e.pageX - row.offsetLeft - startX) * 1.5; });
    });

    initCardTilt();
    initEntrance();
  }

  /* ══════════════════════════════════════════
     CARD DETAIL MODAL
     ══════════════════════════════════════════ */
  function showCardModal(data, type, id) {
    const isGo   = type === 'go';
    const visual = data.image
      ? `<img src="${data.image}" alt="${data.title}" style="width:100%;height:100%;object-fit:cover;" />`
      : `<span class="card-visual-emote">${data.emote}</span>`;
    const confirmLabel = isGo
      ? '<i class="fas fa-shoe-prints me-2"></i>Move'
      : '<i class="fas fa-scroll me-2"></i>Proceed';
    const iconAttr = data.icon
      ? `<i class="${data.icon} card-plate-icon"${ data.iconColor ? ` style="color:${data.iconColor}"` : ''}></i>`
      : '';

    document.getElementById('card-detail-inner').innerHTML = `
      <div class="card-detail-wrapper card-dimension-large">
        <button class="card-detail-close" data-bs-dismiss="modal" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
        <div class="card-detail-card">
          <div class="card-title-plate">
            <span>${data.title}</span>${iconAttr}
          </div>
          <div class="card-body-left">
            <div class="card-visual">${visual}</div>
            <div class="card-desc-area"><p>${data.desc}</p></div>
          </div>
          <div class="card-detail-footer">
            <button class="story-preview-play-btn" id="btn-card-confirm">${confirmLabel}</button>
            <button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button>
          </div>
          <div class="card-magic-footer"><button class="card-info-btn" title="Copyright info"><i class="fas fa-info-circle"></i></button></div>
        </div>
      </div>`;

    document.getElementById('btn-card-confirm').addEventListener('click', () => {
      bootstrap.Modal.getInstance(document.getElementById('cardDetailModal'))?.hide();
      if (isGo) {
        navigateTo(id);
      } else {
        showPopup(`✦ ${data.title}: coming soon… ✦`);
      }
    });

    new bootstrap.Modal(document.getElementById('cardDetailModal')).show();
  }

  /* ══════════════════════════════════════════
     GAME BAR EVENTS
     ══════════════════════════════════════════ */
  btnMap?.addEventListener('click', () => {
    showPopup('✦ The map is not yet available… ✦');
  });

  btnJournal?.addEventListener('click', () => {
    showPopup('✦ The journal is not yet available… ✦');
  });

  document.getElementById('btn-inventory')?.addEventListener('click', () => {
    showPopup('✦ The inventory is not yet available… ✦');
  });

  /* Global (i) info button — shows copyright modal from any card */
  document.addEventListener('click', e => {
    const btn = e.target.closest('.card-info-btn');
    if (btn) {
      e.stopPropagation();
      new bootstrap.Modal(document.getElementById('infoModal')).show();
    }
  });

  /* Close game (click brand while playing) */
  document.querySelector('.navbar-brand')?.addEventListener('click', e => {
    if (activeStory) {
      e.preventDefault();
      stopStory();
    }
  });

  /* ══════════════════════════════════════════
     CARD 3D TILT
     ══════════════════════════════════════════ */
  function initCardTilt() {
    document.querySelectorAll('.location-card, .go-card, .action-card').forEach(card => {
      const isSmall = card.classList.contains('go-card') || card.classList.contains('action-card');
      card.addEventListener('mousemove', e => {
        const r  = card.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
        const dy = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
        const tz = isSmall ? 4 : 8;
        card.style.transform =
          `perspective(900px) rotateX(${-dy * 8}deg) rotateY(${dx * 8}deg) translateY(-${tz}px) scale(1.04)`;
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
          const delay = i * 0.08;
          entry.target.style.animationDelay = `${delay}s`;
          entry.target.style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.location-card, .go-card, .action-card').forEach(card => {
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

  /* ══════════════════════════════════════════
     USER BUTTON (placeholder — no real auth)
     ══════════════════════════════════════════ */
  document.getElementById('btn-user')?.addEventListener('click', () => {
    showPopup('✦ Login is not yet available — continuing as guest ✦');
  });

  /* ══════════════════════════════════════════
     INIT
     ══════════════════════════════════════════ */
  renderCatalog();
  initBadgeCarousel();

})();

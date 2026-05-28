/* =============================================
   card3d.js — 3D Tilt Effect on Hover (v0.15.4)
   =============================================
   Enhanced version that:
   - Tracks initialized cards to avoid duplicate listeners
   - Auto-creates shine overlay if missing
   - Works with dynamically added cards (call add3dEffect())
   ============================================= */

const _card3d_initialized = new WeakSet();

document.addEventListener('DOMContentLoaded', () => {
  add3dEffect();
});

const add3dEffect = () => {
  document.querySelectorAll('.card-3d').forEach(card => {
    if (_card3d_initialized.has(card)) return;
    _card3d_initialized.add(card);

    // Ensure shine overlay exists
    let shine = card.querySelector('.card-3d-shine');
    if (!shine) {
      shine = document.createElement('div');
      shine.className = 'card-3d-shine';
      card.appendChild(shine);
    }

    // ── MOUSEMOVE: calculate rotation and shine ──
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateY = ((x - centerX) / centerX) * 15;
      const rotateX = ((centerY - y) / centerY) * 10;

      card.style.setProperty('transform',
        `perspective(600px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`, 'important');

      const pctX = (x / rect.width) * 100;
      const pctY = (y / rect.height) * 100;
      shine.style.background =
        `radial-gradient(circle at ${pctX}% ${pctY}%, rgba(255,215,0,0.18), transparent 60%)`;
      shine.style.opacity = '1';
    });

    // ── MOUSELEAVE: reset everything ──
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('transform',
        'perspective(600px) rotateY(0deg) rotateX(0deg)', 'important');
      shine.style.opacity = '0';
    });
  });
};

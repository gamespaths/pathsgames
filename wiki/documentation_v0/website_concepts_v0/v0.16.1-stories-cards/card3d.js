/* =============================================
   card3d.js — Subtle 3D Tilt Effect (v0.16.1)
   =============================================
   Reduced rotation (max 6°/4° vs 15°/10°)
   and softer shine for a gentler effect.
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

    // ── MOUSEMOVE: subtle rotation and dim shine ──
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Reduced: max ±6° Y, ±4° X (was ±15°/±10°)
      const rotateY = ((x - centerX) / centerX) * 6;
      const rotateX = ((centerY - y) / centerY) * 4;

      card.style.setProperty('transform',
        `perspective(800px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`, 'important');

      const pctX = (x / rect.width) * 100;
      const pctY = (y / rect.height) * 100;
      // Softer shine: lower opacity, wider spread
      shine.style.background =
        `radial-gradient(circle at ${pctX}% ${pctY}%, rgba(255,215,0,0.08), transparent 70%)`;
      shine.style.opacity = '1';
    });

    // ── MOUSELEAVE: reset ──
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('transform',
        'perspective(800px) rotateY(0deg) rotateX(0deg)', 'important');
      shine.style.opacity = '0';
    });
  });
};

/* =============================================
   card3d.js — 3D Tilt Effect on Hover
   =============================================
   This script implements the "fold/tilt" effect
   on cards with the .card-3d class.

   HOW IT WORKS:
   1. On mousemove, calculate the mouse position
      relative to the card's center.
   2. Convert the distance into rotation degrees
      (max ±15° horizontal, ±10° vertical).
   3. Apply perspective() + rotateX/Y via
      inline CSS transform.
   4. A .card-3d-shine overlay shows a radial
      reflection that follows the cursor.
   5. On mouseleave, everything returns to 0°.
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  add3dEffect();
}
);
const add3dEffect = () => {
  // Select all cards with 3D effect
  const cards = document.querySelectorAll('.card-3d');

  cards.forEach(card => {
    const shine = card.querySelector('.card-3d-shine');

    // ── MOUSEMOVE: calculate rotation and shine ──
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();

      // Mouse position relative to the card
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Card center
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate rotation angles:
      // - If the mouse is RIGHT of the center → positive rotateY (turns right)
      // - If the mouse is ABOVE the center → positive rotateX (tilts towards us)
      // The factors (15 and 10) control the effect's intensity
      const rotateY = ((x - centerX) / centerX) * 15;  // max ±15 degrees
      const rotateX = ((centerY - y) / centerY) * 10;   // max ±10 degrees

      // Apply 3D transformation
      // perspective(600px) defines the "eye distance" from the card
      // Lower values = more dramatic effect
      card.style.transform =
        `perspective(600px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
      //set traformation !important
      card.style.setProperty('transform', card.style.transform, 'important');


      // Update the shine reflection
      if (shine) {
        const pctX = (x / rect.width) * 100;
        const pctY = (y / rect.height) * 100;
        shine.style.background =
          `radial-gradient(circle at ${pctX}% ${pctY}%, rgba(255,215,0,0.18), transparent 60%)`;
        shine.style.opacity = '1';
      }
    });

    // ── MOUSELEAVE: reset everything ──
    card.addEventListener('mouseleave', () => {
      // Return card to original position (no rotation)
      card.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg)';

      // Hide the shine
      if (shine) {
        shine.style.opacity = '0';
      }
    });
  });

};

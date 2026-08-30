/* Auto-redirect to the game. The landing page is not removed: the countdown can be
   cancelled and "?stay" skips the redirect for the rest of the browser session. */
(function () {
  var TARGET = 'https://test.paths.games/';
  var DELAY_SECONDS = 0; // set to 0 to jump to the game with no countdown
  var STAY_KEY = 'pathsgames.stayOnLanding';

  function isStaying() {
    try { return sessionStorage.getItem(STAY_KEY) === '1'; } catch (e) { return false; }
  }

  function rememberStay() {
    try { sessionStorage.setItem(STAY_KEY, '1'); } catch (e) { /* private mode: ignore */ }
  }

  if (window.location.search.indexOf('stay') !== -1) { rememberStay(); }
  if (isStaying()) { return; }

  if (DELAY_SECONDS <= 0) { window.location.replace(TARGET); return; }

  var bar = document.getElementById('pg-redirect');
  var counter = document.getElementById('pg-redirect-count');
  var stayBtn = document.getElementById('pg-redirect-stay');
  if (!bar || !counter || !stayBtn) { return; }

  var left = DELAY_SECONDS;
  counter.textContent = left;
  bar.hidden = false;

  var timer = setInterval(function () {
    left -= 1;
    if (left <= 0) {
      clearInterval(timer);
      window.location.replace(TARGET);
      return;
    }
    counter.textContent = left;
  }, 1000);

  stayBtn.addEventListener('click', function () {
    clearInterval(timer);
    rememberStay();
    bar.hidden = true;
  });
})();

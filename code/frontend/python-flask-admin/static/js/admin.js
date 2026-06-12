/* Minimal admin JS.
 *
 * The ONLY interactive enhancement: the "Fast card / Fast text" modals submit
 * via fetch (so the page does not change), then write the new id back into the
 * entity form field. Everything else in the console is plain server-rendered
 * HTML forms — no framework, no SPA.
 */
(function () {
  'use strict';

  function fillEntityField(form, name) {
    return document.querySelector('#entityForm [name="' + name + '"]');
  }

  function firstFieldWithPrefix(prefix) {
    var fields = document.querySelectorAll('#entityForm [name]');
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].name.indexOf(prefix) === 0) return fields[i];
    }
    return null;
  }

  function handleFastForm(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var action = form.getAttribute('data-action');
      var result = form.querySelector('.pg-fast-result');
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(action, { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'fetch' } })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (submitBtn) submitBtn.disabled = false;
          if (!res.ok || !res.body.ok) {
            if (result) { result.style.display = 'block'; result.className = 'pg-fast-result mt-1 pg-alert pg-alert-danger'; result.textContent = (res.body && res.body.error) || 'Create failed'; }
            return;
          }
          var id = res.body.id;
          var target = null;
          if (form.getAttribute('data-target-name')) target = fillEntityField(form, form.getAttribute('data-target-name'));
          else if (form.getAttribute('data-target-prefix')) target = firstFieldWithPrefix(form.getAttribute('data-target-prefix'));
          if (target && id != null) { target.value = id; target.classList.add('is-valid'); }
          if (result) { result.style.display = 'block'; result.className = 'pg-fast-result mt-1 pg-alert pg-alert-success'; result.textContent = 'Created with id ' + id + (target ? ' → filled "' + target.name + '"' : ''); }
          var modalEl = document.getElementById(form.getAttribute('data-modal'));
          if (modalEl && window.bootstrap) {
            setTimeout(function () { var m = window.bootstrap.Modal.getInstance(modalEl); if (m) m.hide(); }, 800);
          }
          form.reset();
        })
        .catch(function (err) {
          if (submitBtn) submitBtn.disabled = false;
          if (result) { result.style.display = 'block'; result.className = 'pg-fast-result mt-1 pg-alert pg-alert-danger'; result.textContent = String(err); }
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.pg-fast-form').forEach(handleFastForm);
  });
})();

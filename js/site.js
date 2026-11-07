/* Shared on every page: sticky menu background and the sample sign-up form.
   OssuarySite.init() wires the current page's content; js/router.js calls it after a page swap. */

// Sticky menu: add a background once the page is scrolled past the top (the menu never changes).
(function () {
  var nav = document.querySelector('.nav');
  if (!nav) return;
  function update() { nav.classList.toggle('is-scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', update, { passive: true });
  update();
})();

window.OssuarySite = {
  init: function () {
    // Sample sign-up form: no email service is connected yet, so nothing is sent.
    var form = document.querySelector('.signup__form');
    if (!form || form.dataset.wired) return;
    form.dataset.wired = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input');
      var out = form.querySelector('output');
      if (!input.checkValidity()) {
        out.textContent = 'Enter an email address like name@example.com.';
        input.focus();
        return;
      }
      out.textContent = 'Signed up. (Preview only: no email service is connected yet.)';
      input.value = '';
    });
  }
};
window.OssuarySite.init();

/* Ossuary Works: cart drawer.
   - Quick add (on each product image) adds the selected size and opens the drawer.
   - The cart icon opens the drawer; Esc, the close button or clicking outside closes it.
   - Items are kept in this browser's localStorage so the cart survives a reload.
   - No store is connected yet, so Checkout explains that instead of taking payment. */
(function () {
  var STORE_KEY = 'ossuary-cart';
  var cartBtn = document.querySelector('.cart');
  var badge = cartBtn.querySelector('.cart__count');
  var drawer = document.getElementById('cart-drawer');
  var scrim = document.querySelector('.drawer-scrim');
  var list = drawer.querySelector('.drawer__items');
  var subtotalEl = drawer.querySelector('.drawer__subtotal');
  var savingsEl = drawer.querySelector('.drawer__savings');
  var checkoutBtn = drawer.querySelector('.drawer__checkout');
  var msg = drawer.querySelector('.drawer__msg');
  var status = document.getElementById('cart-status');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- State ---------- */
  var items = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch (e) { /* private mode: cart lasts this visit */ }
  }
  function count() { return items.reduce(function (n, it) { return n + it.qty; }, 0); }
  function money(n) { return '$' + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0); }

  function add(product, size) {
    var key = product.dataset.id + ':' + size;
    var found = items.filter(function (it) { return it.key === key; })[0];
    if (found) found.qty += 1;
    else items.push({
      key: key,
      name: product.dataset.name,
      kind: product.dataset.kind,
      size: size,
      price: Number(product.dataset.price),
      was: Number(product.dataset.was) || 0,
      thumb: product.dataset.thumb,
      qty: 1
    });
    save();
    render();
  }

  function setQty(key, qty) {
    items = items.filter(function (it) {
      if (it.key !== key) return true;
      it.qty = qty;
      return qty > 0;
    });
    save();
    render();
  }

  /* ---------- Rendering ---------- */
  function render() {
    var n = count();
    badge.textContent = n;
    cartBtn.setAttribute('aria-label', 'Cart, ' + n + (n === 1 ? ' item' : ' items'));
    drawer.classList.toggle('is-empty', n === 0);
    msg.textContent = '';

    list.innerHTML = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'line';
      li.innerHTML =
        '<div class="line__thumb"><img alt=""></div>' +
        '<div class="line__info">' +
          '<p class="line__kind"></p>' +
          '<p class="line__name"></p>' +
          '<p class="line__meta">Washed Black, size <span class="line__size"></span></p>' +
          '<div class="line__row">' +
            '<div class="qty" role="group">' +
              '<button type="button" class="qty__btn" data-step="-1"><span aria-hidden="true">−</span></button>' +
              '<span class="qty__n" aria-live="polite"></span>' +
              '<button type="button" class="qty__btn" data-step="1"><span aria-hidden="true">+</span></button>' +
            '</div>' +
            '<p class="line__price"></p>' +
          '</div>' +
          '<button type="button" class="line__remove">Remove</button>' +
        '</div>';
      var label = it.name + ' ' + it.kind.toLowerCase() + ', size ' + it.size;
      li.querySelector('.line__thumb img').src = it.thumb;
      li.querySelector('.line__kind').textContent = it.kind;
      li.querySelector('.line__name').textContent = it.name;
      li.querySelector('.line__size').textContent = it.size;
      li.querySelector('.qty').setAttribute('aria-label', 'Quantity for ' + label);
      li.querySelector('.qty__n').textContent = it.qty;
      li.querySelector('[data-step="-1"]').setAttribute('aria-label', 'Remove one ' + label);
      li.querySelector('[data-step="1"]').setAttribute('aria-label', 'Add one more ' + label);
      li.querySelector('.line__remove').setAttribute('aria-label', 'Remove ' + label + ' from cart');
      li.querySelector('.line__price').innerHTML =
        (it.was > it.price ? '<s>' + money(it.was * it.qty) + '</s> ' : '') + money(it.price * it.qty);

      li.querySelectorAll('.qty__btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var next = it.qty + Number(b.dataset.step);
          setQty(it.key, next);
          // Keep keyboard focus in the same place after re-render
          var again = list.querySelector('[data-key="' + it.key + '"] [data-step="' + b.dataset.step + '"]');
          if (again) again.focus(); else focusFirst();
        });
      });
      li.querySelector('.line__remove').addEventListener('click', function () {
        setQty(it.key, 0);
        status.textContent = label + ' removed from cart.';
        focusFirst();
      });
      li.dataset.key = it.key;
      list.appendChild(li);
    });

    var subtotal = items.reduce(function (s, it) { return s + it.price * it.qty; }, 0);
    var savings = items.reduce(function (s, it) { return s + Math.max(0, it.was - it.price) * it.qty; }, 0);
    subtotalEl.textContent = money(subtotal);
    savingsEl.textContent = money(savings);
    drawer.classList.toggle('has-savings', savings > 0);
  }

  /* ---------- Open / close ---------- */
  var lastFocus = null;

  function focusables() {
    return [].slice.call(drawer.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetParent !== null; });
  }
  function focusFirst() { var f = focusables(); if (f.length) f[0].focus(); }

  function open() {
    if (drawer.classList.contains('is-open')) return;
    lastFocus = document.activeElement;
    drawer.hidden = false;
    scrim.hidden = false;
    // Force a layout so the slide-in transition starts from the closed position
    void drawer.offsetWidth;
    drawer.classList.add('is-open');
    scrim.classList.add('is-open');
    document.documentElement.classList.add('drawer-locked');
    cartBtn.setAttribute('aria-expanded', 'true');
    drawer.querySelector('.drawer__close').focus();
  }

  function close() {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-open');
    document.documentElement.classList.remove('drawer-locked');
    cartBtn.setAttribute('aria-expanded', 'false');
    setTimeout(function () {
      if (!drawer.classList.contains('is-open')) { drawer.hidden = true; scrim.hidden = true; }
    }, reduce ? 0 : 420);
    // Return focus to whatever opened the drawer; fall back to the cart icon
    var back = lastFocus && lastFocus !== document.body && document.contains(lastFocus) ? lastFocus : cartBtn;
    back.focus();
    if (drawer.contains(document.activeElement)) cartBtn.focus();
  }

  cartBtn.addEventListener('click', open);
  document.querySelectorAll('[data-cart-close]').forEach(function (el) {
    el.addEventListener('click', close);
  });

  document.addEventListener('keydown', function (e) {
    if (!drawer.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { // keep focus inside the drawer while it's open
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  checkoutBtn.addEventListener('click', function () {
    msg.textContent = "Checkout isn't open yet. Sign up for updates at the bottom of the page and you'll hear the day it is.";
  });

  /* ---------- Quick add and Add to cart ----------
     One listener on the page, so buttons in content swapped in later (js/router.js) work too. */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.quick-add, .add-to-cart');
    if (!btn) return;
    var product = btn.closest('.product');
    if (!product) return;
    var size = product.querySelector('.sizes input:checked').value;
    add(product, size);
    cartBtn.classList.remove('is-bumped'); void cartBtn.offsetWidth; cartBtn.classList.add('is-bumped');
    status.textContent = product.dataset.name + ' ' + product.dataset.kind.toLowerCase() + ', size ' + size + ', added to cart.';
    open();
  });

  // Close the drawer when the page-swap navigation moves to another page
  document.addEventListener('ossuary:navigate', close);

  render();
})();

/* Ossuary Works: page-swap navigation.
   Clicking a link to another page of the site fetches that page and swaps its content in,
   instead of reloading. The menu, cart drawer and ambient sound stay alive, so the sound
   never restarts. The address bar, Back/Forward, titles and scroll positions behave normally.
   Anything unexpected (a failed fetch, an odd link) falls back to a normal page load. */
(function () {
  if (!window.fetch || !window.DOMParser || !history.pushState) return;
  if (location.protocol === 'file:') return; // pages opened straight from a file can't fetch each other

  // These stay on screen across pages; everything else in <body> is the page's own content
  function isPersistent(node) {
    return node.nodeType !== 1 ||
      node.matches('script, .skip, nav.nav, #cart-status, .drawer-scrim, #cart-drawer');
  }

  function pagePath(url) {
    var u = new URL(url, location.href);
    return u.origin + u.pathname.replace(/index\.html$/, '');
  }

  function isSitePage(u) {
    return u.origin === location.origin && /(\.html|\/)$/.test(u.pathname);
  }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  history.replaceState({ y: window.scrollY }, '');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var busy = false;

  /* ---------- Links ---------- */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var u = new URL(a.getAttribute('href'), location.href);
    if (!isSitePage(u)) return;

    e.preventDefault();
    if (pagePath(u.href) === pagePath(location.href)) {
      // Same page: just scroll to the section (also treats "/" and "/index.html" as one page)
      if (u.hash) {
        history.pushState({ y: window.scrollY }, '', u.hash);
        scrollToHash(u.hash);
      } else {
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      }
      return;
    }
    go(u.href, true);
  });

  window.addEventListener('popstate', function (e) {
    var y = e.state && typeof e.state.y === 'number' ? e.state.y : 0;
    if (pagePath(location.href) === pagePath(currentPage)) {
      if (location.hash) scrollToHash(location.hash); else window.scrollTo(0, y);
      return;
    }
    go(location.href, false, y);
  });

  var currentPage = location.href;

  function scrollToHash(hash) {
    var target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ---------- Swap ---------- */
  function go(url, push, restoreY) {
    if (busy) return;
    busy = true;
    document.dispatchEvent(new CustomEvent('ossuary:navigate', { detail: { url: url } }));
    if (push) history.replaceState({ y: window.scrollY }, ''); // remember where we were for Back

    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        if (!doc.querySelector('nav.nav')) throw new Error('not a site page');
        if (push) history.pushState({ y: 0 }, '', url);
        currentPage = location.href;
        return swap(doc).then(function () {
          var hash = new URL(url, location.href).hash;
          if (typeof restoreY === 'number') window.scrollTo(0, restoreY);
          else if (hash) { window.scrollTo(0, 0); scrollToHash(hash); }
          else window.scrollTo(0, 0);
        });
      })
      .catch(function () { location.href = url; }) // fall back to a normal page load
      .then(function () { busy = false; });
  }

  function swap(doc) {
    document.title = doc.title;
    document.body.className = doc.body.className;

    // Stylesheets the new page needs that aren't loaded yet
    var waits = [];
    doc.querySelectorAll('head link[rel="stylesheet"]').forEach(function (l) {
      var href = new URL(l.getAttribute('href'), location.href).href;
      var have = [].some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (x) { return x.href === href; });
      if (!have) {
        var link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = href;
        waits.push(new Promise(function (res) { link.onload = link.onerror = res; }));
        document.head.appendChild(link);
      }
    });

    return Promise.all(waits).then(function () {
      // Menu: same structure on every page; copy over link targets and which page is current
      var oldLinks = document.querySelectorAll('nav.nav ul a, nav.nav .logo');
      var newLinks = doc.querySelectorAll('nav.nav ul a, nav.nav .logo');
      oldLinks.forEach(function (a, i) {
        var n = newLinks[i];
        if (!n) return;
        a.setAttribute('href', n.getAttribute('href'));
        if (n.hasAttribute('aria-current')) a.setAttribute('aria-current', n.getAttribute('aria-current'));
        else a.removeAttribute('aria-current');
      });

      // Page content: remove the old, bring in the new, just before the page scripts
      [].slice.call(document.body.children).forEach(function (n) { if (!isPersistent(n)) n.remove(); });
      var anchor = document.body.querySelector(':scope > script');
      [].slice.call(doc.body.children).forEach(function (n) {
        if (isPersistent(n)) return;
        document.body.insertBefore(document.importNode(n, true), anchor);
      });

      // Scripts the new page uses that aren't loaded yet (each sets itself up when it loads)
      var loads = [];
      doc.querySelectorAll('script[src]').forEach(function (s) {
        var src = new URL(s.getAttribute('src'), location.href).href;
        var have = [].some.call(document.querySelectorAll('script[src]'), function (x) { return x.src === src; });
        if (!have) {
          var el = document.createElement('script');
          el.src = src;
          loads.push(new Promise(function (res) { el.onload = el.onerror = res; }));
          document.body.appendChild(el);
        }
      });

      // Re-run the setup of scripts that were already loaded
      if (window.OssuarySite) window.OssuarySite.init();
      if (window.OssuaryNews) window.OssuaryNews.init();
      if (window.OssuaryMotion) window.OssuaryMotion.init();
      if (window.OssuaryParticles) window.OssuaryParticles.init();
      if (window.OssuaryTextFx) window.OssuaryTextFx.init();

      // Fail-safe: never leave the hero hidden if its reveal can't run
      setTimeout(function () {
        var hero = document.querySelector('[data-ink-load]');
        if (hero && !hero.classList.contains('ink-on')) hero.classList.add('ink-done');
      }, 3000);

      // Move focus to the new page's heading so keyboard and screen-reader users land on it
      var h1 = document.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }

      return Promise.all(loads);
    });
  }
})();

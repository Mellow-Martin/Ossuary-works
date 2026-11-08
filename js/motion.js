/* Ossuary Works: scroll motion.
   - Ink reveal: every section marked data-ink="1..3" starts hidden behind a soft ink-smear mask
     that spreads with scroll and is removed once the section is fully in view. The hero
     (data-ink-load) is already on screen, so it bleeds in over ~1.7s when it appears.
   - Parallax: elements marked data-depth move at a fraction of the scroll speed.
   - Bleed-in: elements with .bleed sharpen into view the first time they're seen.
   OssuaryMotion.init() sets this up for whatever page content is currently shown; the page-swap
   navigation (js/router.js) calls it again after swapping in a new page.
   Skipped entirely when the visitor has "reduce motion" turned on. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.OssuaryMotion = { init: function () {} };
  if (reduce) return;

  document.documentElement.classList.add('motion');

  var SMEAR_STRETCH = 1.6; // smear is drawn wider than tall, like a brush dragged sideways
  // Browsers block image masks on pages opened straight from a file, which would leave the
  // masked sections invisible, so the ink reveal is skipped there (it works online / in preview.bat).
  var NO_INK = location.protocol === 'file:';
  var inkSections = [], depthEls = [];

  function smearUrl(n) {
    // Absolute URL: a url() inside a custom property resolves against the stylesheet that uses it
    return new URL('assets/ornaments/smear-' + n + '.png', document.baseURI).href;
  }

  // Size and place the mask so its dense middle covers the on-screen part of the section at p = 1
  function paintMask(s, p, r, vh) {
    var visTop = Math.max(0, -r.top);
    var visBottom = Math.min(r.height, vh - r.top);
    var cx = r.width / 2;
    var cy = (visTop + visBottom) / 2;
    var reachX = cx;
    var reachY = Math.max(1, (visBottom - visTop) / 2);
    // Dense core is ~30% of the image's height; the soft fringe beyond it fades the edge
    // Slow start (power 1.8) so the smear's edge stays on screen through more of the scroll
    var h = Math.pow(p, 1.8) * 3.6 * Math.max(reachY, reachX / SMEAR_STRETCH);
    var w = h * SMEAR_STRETCH;
    s.style.setProperty('--ink-w', w + 'px');
    s.style.setProperty('--ink-h', h + 'px');
    s.style.setProperty('--ink-x', (cx - w / 2) + 'px');
    s.style.setProperty('--ink-y', (cy - h / 2) + 'px');
  }

  function updateInk(vh) {
    inkSections.forEach(function (s) {
      if (!s.classList.contains('ink-on') || s.classList.contains('ink-done')) return;
      var r = s.getBoundingClientRect();
      // 0 when the section's top touches the bottom of the screen, 1 when it reaches 25% from the top
      var p = (vh - r.top) / (vh * 0.85);
      // Done once it reaches that point, or its bottom is on screen (last section can't scroll higher)
      if (p >= 1 || r.bottom <= vh + 1) { s.classList.add('ink-done'); return; }
      paintMask(s, Math.max(0, p), r, vh);
    });
  }

  function updateParallax(vh) {
    var stacked = window.innerWidth <= 900; // stacked layout: keep it calm
    depthEls.forEach(function (d) {
      if (!d.section) return;
      var r = d.section.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var offset = stacked ? 0 : -r.top * d.depth;
      d.el.style.translate = '0 ' + offset.toFixed(1) + 'px';
    });
  }

  /* ---------- One scroll loop for the whole visit ---------- */
  var ticking = false;
  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    updateInk(vh);
    updateParallax(vh);
  }
  function request() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -15% 0px' });

  /* ---------- Set up the current page's content ---------- */
  function init() {
    // Ink reveal
    inkSections = [].slice.call(document.querySelectorAll('[data-ink]'));
    inkSections.forEach(function (s) {
      if (s.classList.contains('ink-on') || s.classList.contains('ink-done')) return; // already set up
      if (NO_INK) { s.classList.add('ink-done'); return; }
      var src = smearUrl(s.dataset.ink);
      s.style.setProperty('--ink-img', 'url("' + src + '")');
      // Only mask once the smear has loaded: a mask that fails to load would hide the whole section.
      // Sections already scrolled past or fully on screen are never masked.
      var probe = new Image();
      probe.onload = function () {
        var r = s.getBoundingClientRect();
        if (r.bottom <= window.innerHeight + 1) { s.classList.add('ink-done'); return; }
        s.classList.add('ink-on');
        request();
      };
      probe.src = src;
    });

    // Hero: timed bleed-in. It starts hidden (see css/motion.css); a fail-safe reveals it if needed.
    var hero = document.querySelector('[data-ink-load]');
    if (hero && NO_INK) hero.classList.add('ink-done');
    if (hero && !hero.classList.contains('ink-on') && !hero.classList.contains('ink-done')) {
      var heroSrc = smearUrl(hero.dataset.inkLoad);
      hero.style.setProperty('--ink-img', 'url("' + heroSrc + '")');
      var heroProbe = new Image();
      heroProbe.onload = function () {
        if (hero.getBoundingClientRect().bottom <= 0) { hero.classList.add('ink-done'); return; }
        var start = null, DURATION = 1700;
        function step(t) {
          if (start === null) start = t;
          var k = Math.min(1, (t - start) / DURATION);
          var eased = 1 - Math.pow(1 - k, 2.2);
          paintMask(hero, eased, hero.getBoundingClientRect(), window.innerHeight);
          hero.classList.add('ink-on');
          if (k < 1) requestAnimationFrame(step); else hero.classList.add('ink-done');
        }
        requestAnimationFrame(step);
      };
      heroProbe.onerror = function () { hero.classList.add('ink-done'); };
      heroProbe.src = heroSrc;
    }

    // Parallax
    depthEls = [].slice.call(document.querySelectorAll('[data-depth]')).map(function (el) {
      return { el: el, depth: parseFloat(el.dataset.depth), section: el.closest('section, header') };
    });

    // Bleed-in titles
    document.querySelectorAll('.bleed:not(.is-in)').forEach(function (el) { io.observe(el); });

    frame();
  }

  window.OssuaryMotion.init = init;
  init();
})();

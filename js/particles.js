/* Ossuary Works: drifting particles, one layer per section (the hero's is the densest).
   Each section gets its own small canvas, its own wind and density, and its particles fade out
   toward the section's edges, so the page never reads as one rectangle covered in specks.
   Only sections on screen animate. Skipped when the visitor prefers reduced motion.
   OssuaryParticles.init() picks up new sections after a page swap (js/router.js). */
(function () {
  window.OssuaryParticles = { init: function () {} };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SECTIONS = '.hero, main > section, main > header, main > .page-head';
  var layers = [];           // { el, canvas, ctx, w, h, parts, wind, visible }
  var seed = 0;

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var layer = layers.filter(function (l) { return l.el === e.target; })[0];
      if (layer) layer.visible = e.isIntersecting;
    });
    kick();
  }, { rootMargin: '100px 0px' });

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeParticle(l, anywhere) {
    return {
      x: rand(0, l.w),
      y: anywhere ? rand(0, l.h) : rand(0, l.h),
      r: Math.random() < 0.8 ? rand(0.6, 1.5) : rand(1.6, 2.6),  // mostly dust, some larger flecks
      a: rand(0.3, 0.85),                                         // base brightness
      vx: rand(0.6, 1.4),                                         // multiplied by the section's wind
      vy: rand(-0.18, 0.05),                                      // mostly rising, like ash
      sway: rand(0, Math.PI * 2),
      swaySpeed: rand(0.004, 0.012),
      tw: rand(0, Math.PI * 2)
    };
  }

  function size(l) {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    l.w = l.el.clientWidth;
    l.h = l.el.clientHeight;
    l.canvas.width = Math.round(l.w * dpr);
    l.canvas.height = Math.round(l.h * dpr);
    l.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Density by area, so tall and short sections look equally sparse; fewer on small screens
    var per = window.innerWidth < 900 ? 21300 : 14700; // 25% fewer than before
    var n = Math.min(135, Math.round((l.w * l.h) / per * l.density));
    while (l.parts.length < n) l.parts.push(makeParticle(l, true));
    l.parts.length = n;
  }

  function addLayer(el) {
    if (el.querySelector(':scope > canvas.particles')) return;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    var canvas = document.createElement('canvas');
    canvas.className = 'particles';
    canvas.setAttribute('aria-hidden', 'true');
    el.insertBefore(canvas, el.firstChild);
    seed++;
    var l = {
      el: el,
      canvas: canvas,
      ctx: canvas.getContext('2d'),
      parts: [],
      // Each section gets its own breeze: direction alternates, strength and density vary
      wind: (seed % 2 ? 1 : -1) * rand(0.12, 0.3),
      // The hero is the first thing people see, so it gets a thicker drift of ash
      density: el.classList.contains('hero') ? 1.6 : rand(0.8, 1.2),
      visible: false
    };
    layers.push(l);
    size(l);
    io.observe(el);
  }

  /* ---------- Animation ---------- */
  var running = false, last = 0;
  function kick() {
    if (!running && layers.some(function (l) { return l.visible; })) {
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function edgeFade(v, size, zone) {
    // 0 at the edge, 1 once `zone` pixels in: particles fade out toward a section's borders
    return Math.max(0, Math.min(1, v / zone, (size - v) / zone));
  }

  function tick(now) {
    var dt = Math.min(3, (now - last) / 16.7); // frames' worth of time; capped after tab switches
    last = now;
    var any = false;
    layers.forEach(function (l) {
      if (!l.visible) return;
      any = true;
      var ctx = l.ctx, w = l.w, h = l.h;
      var zoneY = Math.min(160, h * 0.15), zoneX = Math.min(100, w * 0.07);
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < l.parts.length; i++) {
        var p = l.parts[i];
        p.sway += p.swaySpeed * dt;
        p.tw += 0.02 * dt;
        p.x += (p.vx * l.wind + Math.sin(p.sway) * 0.12) * dt;
        p.y += (p.vy + Math.cos(p.sway * 0.7) * 0.05) * dt;
        // Wrap around inside the section
        if (p.x < -4) p.x = w + 4; else if (p.x > w + 4) p.x = -4;
        if (p.y < -4) p.y = h + 4; else if (p.y > h + 4) p.y = -4;
        var fade = edgeFade(p.y, h, zoneY) * edgeFade(p.x, w, zoneX);
        if (fade <= 0) continue;
        var alpha = p.a * fade * (0.6 + 0.4 * Math.sin(p.tw)); // shimmer
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
    });
    if (any) requestAnimationFrame(tick); else running = false;
  }

  /* ---------- Setup ---------- */
  function init() {
    // Forget layers whose sections were removed by a page swap
    layers = layers.filter(function (l) {
      if (document.contains(l.el)) return true;
      io.unobserve(l.el);
      return false;
    });
    document.querySelectorAll(SECTIONS).forEach(addLayer);
    layers.forEach(function (l) { size(l); l.ctx.fillStyle = '#ebe8e1'; }); // sections may have grown
    kick();
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      layers.forEach(function (l) { size(l); l.ctx.fillStyle = '#ebe8e1'; });
    }, 200);
  });

  // Sections can grow after load (News posts arrive, images load), so re-measure then too
  window.addEventListener('load', function () { layers.forEach(function (l) { size(l); l.ctx.fillStyle = '#ebe8e1'; }); });

  window.OssuaryParticles.init = init;
  init();
})();

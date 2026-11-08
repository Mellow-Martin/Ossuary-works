/* Ossuary Works: text effects (styles in css/text-fx.css).
   1. Heading scramble   - section h2s and game-title h3s cycle through Greek/Roman glyphs,
                           then settle left to right, once per page load.
   3. Reactive ticker    - the "Katabasis / Project Wake / Oathless" rails become an endless
                           loop that reacts to scroll speed and direction, slows on hover,
                           and glitches briefly every few seconds.
   5. Commerce moments   - price strikethrough draws then the sale price snaps in; the cart
                           count rolls like an odometer; primary buttons snap into [ brackets ].
   OssuaryTextFx.init() wires whatever page content is showing; js/router.js and js/news.js
   call it again after swapping in new content. Reduced motion: final text, no movement. */
(function () {
  /* ================= TIMING: tweak here ================= */
  var SCRAMBLE_FRAME_MS = 50;      // how often scrambling glyphs change (40-60ms)
  var SCRAMBLE_FRAMES = 22;        // total length in frames: 22 x 50ms = 1.1s
  var TICKER_BASE_SPEED = 0.35;    // px per frame at 60fps (about 21px per second)
  var TICKER_HOVER_FACTOR = 0.3;   // hovering slows the ticker to 30%
  var TICKER_SCROLL_PUSH = 0.06;   // how strongly page scrolling pushes the ticker
  var TICKER_PUSH_MAX = 9;         // cap on that push, in px per frame
  var TICKER_PUSH_EASE = 0.92;     // how fast the push fades back to base speed (lower = faster)
  var GLITCH_MIN_MS = 4000;        // a glitch every 4-7 seconds, randomised
  var GLITCH_MAX_MS = 7000;
  var GLITCH_LENGTH_MS = 150;
  var ODOMETER_MS = 240;           // matches the animation length in css/text-fx.css
  /* ====================================================== */

  var GLYPHS = 'ΓΔΘΛΞΠΣΦΨΩⅠⅤⅩⅬⅭⅮⅯ';
  var SCRAMBLE_TARGETS = '.hero__title, .games__title, .armory__title, .signup__title, .game h3';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) document.documentElement.classList.add('fx-on');

  function rand(a, b) { return a + Math.random() * (b - a); }
  function glyph() { return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]; }

  /* ================= 1. Heading scramble ================= */
  var scrambleIO = window.IntersectionObserver && new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      scrambleIO.unobserve(e.target);
      // Wait for the real fonts, so the size we lock is the final size (no wrap jump on slow loads)
      var h = e.target;
      if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(function () { scramble(h); });
      else scramble(h);
    });
  }, { rootMargin: '0px 0px -12% 0px' });

  function scramble(h) {
    var originalHTML = h.innerHTML;
    var finalText = h.textContent.replace(/\s+/g, ' ').trim();
    var lockW = h.style.width, lockH = h.style.height;
    // Remember the natural size now; it's locked after the line breaks are measured.
    // (Width is rounded up: rounding down by a fraction of a pixel made tight titles wrap.)
    var natW = Math.ceil(parseFloat(getComputedStyle(h).width)) + 2;
    var natH = h.offsetHeight;

    var visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    var chars = [];
    (function build(from, into) {
      [].slice.call(from.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { into.appendChild(document.createTextNode(' ')); return; }
            var word = document.createElement('span');
            word.className = 'fx-word';
            [].slice.call(part).forEach(function (c) {
              var ch = document.createElement('span');
              ch.className = 'fx-ch';
              ch.textContent = c;
              ch.dataset.c = c;
              word.appendChild(ch);
              chars.push(ch);
            });
            into.appendChild(word);
          });
        } else if (node.nodeName === 'BR') {
          into.appendChild(document.createElement('br'));
        } else if (node.nodeType === 1 && !node.classList.contains('sr-only')) {
          build(node, into);
        }
      });
    })(h, visual);

    var real = document.createElement('span');
    real.className = 'sr-only';
    real.textContent = finalText;
    h.textContent = '';
    h.appendChild(real);
    h.appendChild(visual);

    // Keep the heading's lines exactly as they are: find where each line starts in the
    // natural layout, put a break there, then stop any other wrapping during the decode.
    // (Letters set one by one lose their kerning and run slightly wider, which used to wrap.)
    var words = [].slice.call(visual.querySelectorAll('.fx-word'));
    var lastTop = null;
    words.forEach(function (w) {
      var top = w.offsetTop;
      if (lastTop !== null && top > lastTop + 2) {
        var prev = w.previousSibling;
        if (prev && prev.nodeName !== 'BR') {
          if (prev.nodeType === 3) prev.remove();
          visual.insertBefore(document.createElement('br'), w);
        }
      }
      lastTop = top;
    });
    visual.style.whiteSpace = 'nowrap';
    // Lock the box so swapping glyphs can't move anything around it
    h.style.width = natW + 'px';
    h.style.height = natH + 'px';

    // Fix each letter's width to the real letter so the line doesn't jitter
    visual.classList.add('fx-locked');
    chars.forEach(function (ch) { ch.style.width = ch.offsetWidth + 'px'; });
    var n = chars.length;
    chars.forEach(function (ch, i) {
      ch.settle = 4 + Math.round((n > 1 ? i / (n - 1) : 1) * (SCRAMBLE_FRAMES - 6));
    });

    var frame = 0;
    var timer = setInterval(function () {
      frame++;
      chars.forEach(function (ch) {
        if (ch.done) return;
        if (frame >= ch.settle) {
          ch.textContent = ch.dataset.c;
          ch.classList.remove('fx-glyph');
          ch.done = true;
        } else {
          ch.textContent = glyph();
          ch.classList.add('fx-glyph');
        }
      });
      if (frame >= SCRAMBLE_FRAMES) {
        clearInterval(timer);
        h.innerHTML = originalHTML;
        h.style.width = lockW;
        h.style.height = lockH;
      }
    }, SCRAMBLE_FRAME_MS);
  }

  function initScramble() {
    if (reduce || !scrambleIO) return;
    document.querySelectorAll(SCRAMBLE_TARGETS).forEach(function (h) {
      if (h.dataset.fxScramble) return;
      h.dataset.fxScramble = '1';
      scrambleIO.observe(h);
    });
  }

  /* ================= 3. Reactive ticker ================= */
  var tickers = [];
  var tickerIO = window.IntersectionObserver && new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      tickers.forEach(function (t) { if (t.ticker === e.target) t.visible = e.isIntersecting; });
    });
    startTicker();
  });

  function buildTicker(rail) {
    var items = [].slice.call(rail.querySelectorAll(':scope > span'));
    if (!items.length || !/Katabasis/.test(rail.textContent)) return;
    rail.dataset.fxTicker = '1';
    rail.classList.add('rail--ticker');
    var ticker = document.createElement('div');
    ticker.className = 'ticker';
    var track = document.createElement('div');
    track.className = 'ticker__track';
    items.forEach(function (s) { track.appendChild(s); });
    ticker.appendChild(track);
    rail.appendChild(ticker);
    var t = {
      rail: rail, ticker: ticker, track: track, ghost: null,
      set: items.map(function (s) { return s.cloneNode(true); }),
      setH: 0, y: 0, hover: false, visible: false,
      nextGlitch: performance.now() + rand(GLITCH_MIN_MS, GLITCH_MAX_MS)
    };
    rail.addEventListener('pointerenter', function () { t.hover = true; });
    rail.addEventListener('pointerleave', function () { t.hover = false; });
    tickers.push(t);
    tickerIO.observe(ticker);
  }

  // Measure one set of names and repeat it enough times to fill the rail with one set to spare
  function measure(t) {
    var railH = t.ticker.clientHeight;
    if (!railH) { t.setH = 0; return; }
    while (t.track.children.length > t.set.length) t.track.lastChild.remove();
    t.setH = t.track.offsetHeight;
    if (!t.setH) return;
    var copies = Math.ceil(railH / t.setH) + 1;
    for (var c = 1; c < copies; c++) {
      t.set.forEach(function (s) { t.track.appendChild(s.cloneNode(true)); });
    }
    if (t.ghost) t.ghost.remove();
    t.ghost = t.track.cloneNode(true);
    t.ghost.className = 'ticker__ghost';
    t.ghost.setAttribute('aria-hidden', 'true');
    t.ticker.appendChild(t.ghost);
  }

  var push = 0, lastScroll = window.scrollY, running = false, lastTime = 0;
  window.addEventListener('scroll', function () {
    var dy = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    // Scrolling down pushes the names one way, scrolling up the other
    push = Math.max(-TICKER_PUSH_MAX, Math.min(TICKER_PUSH_MAX, push + dy * TICKER_SCROLL_PUSH));
  }, { passive: true });
  window.addEventListener('resize', function () { tickers.forEach(function (t) { t.setH = 0; }); });

  function startTicker() {
    if (running || !tickers.some(function (t) { return t.visible; })) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(tickTicker);
  }

  function tickTicker(now) {
    var dt = Math.min(3, (now - lastTime) / 16.7);
    lastTime = now;
    push *= Math.pow(TICKER_PUSH_EASE, dt);
    var any = false;
    tickers.forEach(function (t) {
      if (!t.visible) return;
      any = true;
      if (!t.setH) { measure(t); if (!t.setH) return; }
      var speed = TICKER_BASE_SPEED * (t.hover ? TICKER_HOVER_FACTOR : 1) + push;
      t.y = (((t.y - speed * dt) % t.setH) + t.setH) % t.setH;
      var tf = 'translate3d(0,' + t.y.toFixed(2) + 'px,0)';
      t.track.style.transform = tf;
      if (t.ghost) t.ghost.style.transform = tf;
      if (now >= t.nextGlitch) {
        t.nextGlitch = now + rand(GLITCH_MIN_MS, GLITCH_MAX_MS);
        t.ticker.classList.add('is-glitch');
        setTimeout(function () { t.ticker.classList.remove('is-glitch'); }, GLITCH_LENGTH_MS);
      }
    });
    if (any) requestAnimationFrame(tickTicker); else running = false;
  }

  function initTickers() {
    if (reduce || !tickerIO) return; // reduced motion: the rails stay as they were, static
    tickers = tickers.filter(function (t) {
      if (document.contains(t.ticker)) return true;
      tickerIO.unobserve(t.ticker);
      return false;
    });
    document.querySelectorAll('.rail--left:not([data-fx-ticker])').forEach(buildTicker);
  }

  /* ================= 5a. Price strikethrough + snap ================= */
  var priceIO = window.IntersectionObserver && new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      priceIO.unobserve(e.target);
      e.target.classList.remove('fx-price-pending');
      e.target.classList.add('fx-price-run');
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  function initPrices() {
    if (reduce || !priceIO) return;
    document.querySelectorAll('.product .price').forEach(function (p) {
      if (p.dataset.fxPrice || !p.querySelector('s')) return;
      p.dataset.fxPrice = '1';
      p.classList.add('fx-price-pending');
      priceIO.observe(p);
    });
  }

  /* ================= 5b. Cart count odometer (called from js/cart.js) ================= */
  function odometer(el, from, to) {
    if (reduce || from === to) { el.textContent = to; return; }
    clearTimeout(el._odoTimer);
    el.innerHTML = '';
    var wrap = document.createElement('span');
    wrap.className = 'odo ' + (to > from ? 'odo--up' : 'odo--down');
    var oldD = document.createElement('span'); oldD.className = 'odo__old'; oldD.textContent = from;
    var newD = document.createElement('span'); newD.className = 'odo__new'; newD.textContent = to;
    wrap.appendChild(oldD); wrap.appendChild(newD);
    el.appendChild(wrap);
    el._odoTimer = setTimeout(function () { el.textContent = to; }, ODOMETER_MS + 20);
  }

  /* ================= 5c. Button brackets ================= */
  function initButtons() {
    document.querySelectorAll('.btn--red, .btn--gold').forEach(function (b) {
      if (b.querySelector('.fx-btn')) return;
      [].slice.call(b.childNodes).forEach(function (node) {
        if (node.nodeType !== 3 || !node.textContent.trim()) return;
        var span = document.createElement('span');
        span.className = 'fx-btn';
        span.textContent = node.textContent.trim();
        b.replaceChild(span, node);
      });
    });
  }

  function init() {
    initScramble();
    initTickers();
    initPrices();
    initButtons();
  }

  window.OssuaryTextFx = { init: init, odometer: odometer };
  init();
})();

/* Ossuary Works: ambient sound, generated live in the browser (no audio file to download).
   Layers: a low drone chord, soft wind, an occasional distant bell, all through a long reverb.

   Browsers only allow sound after the visitor interacts, so it starts on the first click,
   tap or key press anywhere, unless the visitor has turned it off before (remembered).
   A button just under the sticky menu (top right) turns it on and off on every page. */
(function () {
  var KEY = 'ossuary-sound';
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  function pref() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function savePref(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  /* ---------- Toggle button ---------- */
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sound-toggle';
  btn.innerHTML =
    '<span class="sound-toggle__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24"><path class="spk" d="M4 9h4l5-4v14l-5-4H4z"/>' +
      '<path class="wave" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>' +
      '<path class="mute" d="M16 9l6 6M22 9l-6 6"/></svg>' +
    '</span>' +
    '<span class="sound-toggle__label">Sound off</span>' +
    '<span class="sr-only sound-toggle__action">, turn on</span>';
  // Lives inside the sticky menu (just under it, on the right) so it stays with the menu
  (document.querySelector('.nav') || document.body).appendChild(btn);
  var label = btn.querySelector('.sound-toggle__label');
  var action = btn.querySelector('.sound-toggle__action');

  /* ---------- Sound graph (built on first use) ---------- */
  var ctx = null, master = null, playing = false, bellTimer = null;

  function build() {
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0;

    // Reverb: a synthetic decaying-noise impulse, about 4.5s, like a stone hall
    var verb = ctx.createConvolver();
    var len = Math.floor(ctx.sampleRate * 4.5);
    var ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = ir.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    var wet = ctx.createGain(); wet.gain.value = 0.55;
    var dry = ctx.createGain(); dry.gain.value = 0.6;
    verb.connect(wet); wet.connect(master);
    dry.connect(master);
    master.connect(ctx.destination);
    function send(node) { node.connect(dry); node.connect(verb); }

    // Drone: A minor (A1, E2, A2, C3) on soft detuned saws through a slowly breathing low-pass
    var droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass'; droneFilter.frequency.value = 260; droneFilter.Q.value = 0.8;
    var breath = ctx.createOscillator(); breath.frequency.value = 0.045;
    var breathAmt = ctx.createGain(); breathAmt.gain.value = 130;
    breath.connect(breathAmt); breathAmt.connect(droneFilter.frequency); breath.start();
    var droneGain = ctx.createGain(); droneGain.gain.value = 0.16;
    droneFilter.connect(droneGain); send(droneGain);
    [[55, 0.5], [82.41, 0.32], [110, 0.22], [130.81, 0.12]].forEach(function (n) {
      [-4, 4].forEach(function (cents) {
        var o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = n[0]; o.detune.value = cents;
        var g = ctx.createGain(); g.gain.value = n[1] / 2;
        o.connect(g); g.connect(droneFilter); o.start();
      });
    });

    // Wind: looping noise through a wandering band-pass, swelling slowly
    var noiseLen = ctx.sampleRate * 4;
    var noise = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    var nd = noise.getChannelData(0), last = 0;
    for (var j = 0; j < noiseLen; j++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; nd[j] = last * 3.5; } // brownish
    var src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    var band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 420; band.Q.value = 0.7;
    var sweep = ctx.createOscillator(); sweep.frequency.value = 0.031;
    var sweepAmt = ctx.createGain(); sweepAmt.gain.value = 220;
    sweep.connect(sweepAmt); sweepAmt.connect(band.frequency); sweep.start();
    var windGain = ctx.createGain(); windGain.gain.value = 0.22;
    var gust = ctx.createOscillator(); gust.frequency.value = 0.07;
    var gustAmt = ctx.createGain(); gustAmt.gain.value = 0.12;
    gust.connect(gustAmt); gustAmt.connect(windGain.gain); gust.start();
    src.connect(band); band.connect(windGain); send(windGain); src.start();

    // Distant bell: inharmonic partials with a long fade, every 20 to 40 seconds
    function bell() {
      if (!playing) return;
      var t = ctx.currentTime + 0.05;
      var root = [110, 98, 123.47][Math.floor(Math.random() * 3)];
      [[1, 0.5, 7], [2.76, 0.22, 4], [5.4, 0.1, 2.5], [8.93, 0.05, 1.5]].forEach(function (p) {
        var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = root * p[0];
        var g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(p[1] * 0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
        o.connect(g); g.connect(verb); // reverb only: sounds far away
        o.start(t); o.stop(t + p[2] + 0.1);
      });
      bellTimer = setTimeout(bell, 20000 + Math.random() * 20000);
    }
    build.bell = bell;
  }

  function fadeTo(value, seconds) {
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(value, t + seconds);
  }

  function start() {
    if (playing) return;
    if (!ctx) build();
    ctx.resume();
    playing = true;
    fadeTo(0.55, 4);
    clearTimeout(bellTimer);
    bellTimer = setTimeout(build.bell, 6000);
    setUI();
  }

  function stop() {
    if (!playing) return;
    playing = false;
    clearTimeout(bellTimer);
    fadeTo(0, 0.6);
    setTimeout(function () { if (!playing && ctx) ctx.suspend(); }, 700);
    setUI();
  }

  function setUI() {
    btn.classList.toggle('is-on', playing);
    // Visible text shows the state; screen readers also hear what a click will do
    label.textContent = playing ? 'Sound on' : 'Sound off';
    action.textContent = playing ? ', turn off' : ', turn on';
  }

  btn.addEventListener('click', function () {
    if (playing) { stop(); savePref('off'); } else { start(); savePref('on'); }
  });

  // First interaction anywhere starts the sound, unless it was turned off before
  function firstTouch(e) {
    if (btn.contains(e.target)) return; // the button handles itself
    removeFirst();
    if (pref() !== 'off') start();
  }
  function removeFirst() {
    ['pointerdown', 'keydown'].forEach(function (t) { document.removeEventListener(t, firstTouch, true); });
  }
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, firstTouch, true); });
  btn.addEventListener('click', removeFirst);

  // Quiet when the tab is in the background
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (playing) ctx.resume();
  });

  setUI();
})();

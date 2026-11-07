/* Ossuary Works: News page, built from content/news.txt.
   Edit that file to add posts; nothing in this script needs to change.
   The newest "patch" post is featured at the top; every other post goes in the timeline. */
(function () {
  var FILE = 'content/news.txt';

  var GAMES = {
    katabasis: { label: 'Katabasis', art: 'assets/Exports/katabasis-game-arch-image.png', star: 'assets/Exports/early-access-star.png', gold: true,
                 alt: 'Katabasis key art: a lone knight before a burning pit under a dragon' },
    oathless:  { label: 'Oathless', art: 'assets/Exports/oathless-game-arch-image.png', star: 'assets/Exports/in-development-star.png',
                 alt: 'Oathless art: a hooded knight with sword and shield walking through a graveyard' },
    wake:      { label: 'Wake', art: 'assets/Exports/wake-game-arch-image.png', star: 'assets/Exports/in-development-star.png',
                 alt: 'Wake art: a knight raising a sword on a tiled floor as hooded shadows close in' },
    studio:    { label: 'Studio', gold: true }
  };
  var TYPES = {
    patch:  { label: 'Patch notes', more: 'Full patch notes' },
    devlog: { label: 'Devlog', more: 'Read the devlog' },
    news:   { label: 'News', more: 'Read more' }
  };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Looked up in init(), since the page-swap navigation can bring the News page in later
  var featuredEl, list, empty;

  /* ---------- Parse ---------- */
  function parse(text) {
    text = text.replace(/\r\n?/g, '\n');
    var start = text.search(/^POSTS START HERE.*$/m);
    if (start >= 0) text = text.slice(text.indexOf('\n', start) + 1);
    return text.split(/^={4,}\s*$/m).map(parsePost).filter(Boolean)
      .sort(function (a, b) { return b.date < a.date ? -1 : b.date > a.date ? 1 : 0; });
  }

  function parsePost(chunk) {
    var lines = chunk.split('\n');
    var post = { blocks: [] }, i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    for (; i < lines.length; i++) {
      var m = lines[i].match(/^\s*(title|date|game|type|version|link)\s*:\s*(.*)$/i);
      if (!m) break;
      post[m[1].toLowerCase()] = m[2].trim();
    }
    if (!post.title || !post.date) return null;
    post.game = (post.game || 'studio').toLowerCase();
    post.type = (post.type || 'news').toLowerCase();
    if (!GAMES[post.game]) post.game = 'studio';
    if (!TYPES[post.type]) post.type = 'news';
    if (post.link) {
      var parts = post.link.split('|');
      post.link = parts.length > 1 ? { text: parts[0].trim(), href: parts.slice(1).join('|').trim() } : null;
    }

    // Body: paragraphs, ## headings, - bullets
    var para = [];
    function flush() { if (para.length) { post.blocks.push({ kind: 'p', text: para.join(' ') }); para = []; } }
    for (; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || /^-{5,}$/.test(line)) { flush(); continue; }
      if (/^##\s+/.test(line)) { flush(); post.blocks.push({ kind: 'h', text: line.replace(/^##\s+/, '') }); continue; }
      if (/^-\s+/.test(line)) { flush(); post.blocks.push({ kind: 'li', text: line.replace(/^-\s+/, '') }); continue; }
      para.push(line);
    }
    flush();
    return post;
  }

  /* ---------- Build ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Plain text with [link text](address) turned into links
  function inline(parent, text) {
    var re = /\[([^\]]+)\]\(([^)\s]+)\)/g, last = 0, m;
    while ((m = re.exec(text))) {
      parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      parent.appendChild(link(m[1], m[2], 'link link--red'));
      last = re.lastIndex;
    }
    parent.appendChild(document.createTextNode(text.slice(last)));
    return parent;
  }

  function link(text, href, cls) {
    var a = el('a', cls, text);
    if (!/^(https?:|mailto:)/i.test(href) && /^[a-z]+:/i.test(href)) href = '#'; // only web, mail or site links
    a.href = href;
    if (/^https?:/i.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener';
      a.appendChild(el('span', 'sr-only', ' (opens in a new tab)'));
    }
    return a;
  }

  function niceDate(iso) {
    var p = iso.split('-').map(Number);
    return p.length === 3 ? p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + p[0] : iso;
  }

  function tags(post, withDate, latest) {
    var g = GAMES[post.game];
    var wrap = el('div', 'entry__tags');
    var gameTag = el('span', 'tag' + (g.gold ? ' tag--gold' : ''));
    if (g.star) { var s = el('img'); s.src = g.star; s.alt = ''; s.width = 48; s.height = 49; gameTag.appendChild(s); }
    gameTag.appendChild(document.createTextNode(latest ? 'Latest patch' : g.label));
    wrap.appendChild(gameTag);
    if (latest) wrap.appendChild(el('span', 'tag', g.label));
    else wrap.appendChild(el('span', 'tag', TYPES[post.type].label));
    if (post.version) wrap.appendChild(el('span', 'tag tag--version', post.version));
    if (withDate) {
      var t = el('time', 'tag', niceDate(post.date));
      t.dateTime = post.date;
      wrap.appendChild(t);
    }
    return wrap;
  }

  // Render body blocks; headings group the bullets under them like the patch-note lists
  function body(blocks) {
    var frag = document.createDocumentFragment();
    var changes = null, group = null, ul = null;
    blocks.forEach(function (b) {
      if (b.kind === 'h') {
        if (!changes) { changes = el('div', 'changes'); frag.appendChild(changes); }
        group = el('div'); group.appendChild(el('h3', null, b.text)); changes.appendChild(group); ul = null;
      } else if (b.kind === 'li') {
        if (!ul) { ul = el('ul'); (group || frag).appendChild(ul); }
        ul.appendChild(inline(el('li'), b.text));
      } else {
        ul = null;
        (group || frag).appendChild(inline(el('p'), b.text));
      }
    });
    return frag;
  }

  function renderFeatured(post) {
    var g = GAMES[post.game];
    featuredEl.innerHTML = '';
    featuredEl.dataset.game = post.game;
    if (g.art) {
      var arch = el('div', 'arch');
      var art = el('img', 'arch__art'); art.src = g.art; art.alt = g.alt;
      var frame = el('img', 'arch__frame'); frame.src = 'assets/Exports/arch-frame.png'; frame.alt = '';
      arch.appendChild(art); arch.appendChild(frame);
      featuredEl.appendChild(arch);
    } else {
      featuredEl.classList.add('featured--no-art');
    }
    var col = el('div');
    var label = tags(post, true, true); label.className = 'featured__label';
    col.appendChild(label);
    var h = el('h2', null, post.title); h.id = 'featured-title';
    col.appendChild(h);
    var first = post.blocks[0] && post.blocks[0].kind === 'p' ? post.blocks[0] : null;
    if (first) col.appendChild(inline(el('p', 'featured__summary'), first.text));
    col.appendChild(body(first ? post.blocks.slice(1) : post.blocks));
    if (post.link) {
      var act = el('div', 'actions featured__actions');
      act.appendChild(link(post.link.text, post.link.href, 'btn btn--red'));
      col.appendChild(act);
    }
    featuredEl.appendChild(col);
    featuredEl.hidden = false;
  }

  function renderEntry(post) {
    var li = el('li', 'entry');
    li.dataset.game = post.game;
    li.dataset.type = post.type;
    var t = el('time', null, niceDate(post.date)); t.dateTime = post.date;
    li.appendChild(t);
    var b = el('div', 'entry__body');
    b.appendChild(tags(post, false, false));
    b.appendChild(el('h3', null, post.title));
    var first = post.blocks[0] && post.blocks[0].kind === 'p' ? post.blocks[0] : null;
    if (first) b.appendChild(inline(el('p'), first.text));
    var rest = first ? post.blocks.slice(1) : post.blocks;
    if (rest.length) {
      var d = el('details');
      d.appendChild(el('summary', null, TYPES[post.type].more));
      d.appendChild(body(rest));
      b.appendChild(d);
    }
    if (post.link) b.appendChild(link(post.link.text, post.link.href, 'link link--red'));
    li.appendChild(b);
    return li;
  }

  /* ---------- Filters ---------- */
  function wireFilters() {
    var buttons = document.querySelectorAll('.filters button');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.dataset.filter;
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        var shown = 0;
        list.querySelectorAll('.entry').forEach(function (e) {
          var show = f === 'all' || e.dataset.game === f;
          e.hidden = !show;
          if (show) shown++;
        });
        if (featuredEl.dataset.game) featuredEl.hidden = !(f === 'all' || featuredEl.dataset.game === f);
        empty.hidden = shown > 0 || !featuredEl.hidden;
      });
    });
  }

  /* ---------- Load (only on the page that has the news feed) ---------- */
  function init() {
    featuredEl = document.getElementById('featured');
    list = document.querySelector('.feed__list');
    empty = document.querySelector('.feed__empty');
    if (!list || list.dataset.loaded) return;
    list.dataset.loaded = '1';
    var thisList = list;
    fetch(FILE, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        if (!document.contains(thisList)) return; // visitor already moved to another page
        var posts = parse(text);
        var featured = posts.filter(function (p) { return p.type === 'patch'; })[0];
        if (featured) renderFeatured(featured);
        posts.forEach(function (p) { if (p !== featured) list.appendChild(renderEntry(p)); });
        empty.hidden = posts.length > 0;
        wireFilters();
        if (window.OssuaryMotion) window.OssuaryMotion.init(); // new sections join the ink reveal
        if (window.OssuaryParticles) window.OssuaryParticles.init(); // and get particles sized to fit
      })
      .catch(function () {
        empty.textContent = location.protocol === 'file:'
          // Browsers won't let a page opened straight from a file read content/news.txt
          ? 'Posts show when the site runs online, or locally through preview.bat (double-click it in the site folder).'
          : "News couldn't load. Try refreshing the page.";
        empty.hidden = false;
      });
  }

  window.OssuaryNews = { init: init };
  init();
})();

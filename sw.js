// Service worker: makes the site work offline after the first visit.
// Bump VERSION whenever you deploy changes so phones pick up the new files.
const VERSION = 'cbh-v25';
// Pokémon icons are cached as they're seen, in a cache that survives normal deploys. Its name carries a
// fingerprint of the icons, written by tools/get_sprites.py, so rebuilt icons replace the old ones.
const IMG = 'cbh-icons-4aef74df';
const TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
const FILES = [
  './', 'index.html', 'about.html', 'manifest.webmanifest',
  'css/style.css', 'js/data.js', 'js/app.js', 'js/team.js', 'js/theme.js',
  'data/pokemon.js', 'data/abilities.js', 'data/champions.js', 'data/sprites.js',
  'assets/fonts/bricolage-grotesque-latin.woff2',
  'assets/icons/icon-192.png', 'assets/icons/favicon-32.png',
  ...TYPES.map(t => `assets/types/${t}.webp`)
];

// Some hosts redirect about.html to /about. Browsers won't show a stored redirect as a page, so keep a plain copy.
const plain = res => {
  if (!res.redirected) return Promise.resolve(res);
  const headers = new Headers(res.headers);
  headers.delete('content-encoding'); headers.delete('content-length');   // the body is already decoded
  return res.blob().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers }));
};

// Each deploy bumps VERSION, so a new install fills a fresh cache that the running site never reads from:
// the site only ever looks in its own VERSION cache (and the icon cache), never in another version's.
const NUM = +VERSION.match(/\d+$/)[0];
const own = (req, opts) => caches.open(VERSION).then(c => c.match(req, opts));
const complete = () => caches.open(VERSION).then(c => Promise.all(FILES.map(u => c.match(u)))).then(rs => rs.every(Boolean));

// Download everything first and store it only if every file arrived.
const fill = () => Promise.all(FILES.map(u => fetch(new Request(u, { cache: 'reload' })).then(res => {
  if (!res.ok) throw new Error(`Could not cache ${u}`);
  return plain(res);
}))).then(rs => caches.open(VERSION).then(c => Promise.all(rs.map((r, i) => c.put(FILES[i], r)))));

self.addEventListener('install', e => {
  e.waitUntil(caches.has(VERSION).then(existed => complete()
    .then(done => done ? null : fill())   // same VERSION already fully stored: nothing to do
    // e.g. storage full: don't keep a half-filled cache (unless it was there before this install)
    .catch(err => (existed ? Promise.resolve() : caches.delete(VERSION)).then(() => { throw err })))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // Delete older versions and old icon caches only: a newer version may be installing at the same time.
  const old = k => { const m = /^cbh-v(\d+)/.exec(k); return m ? +m[1] < NUM || (+m[1] === NUM && k !== VERSION)
    : k.startsWith('cbh-icons-') && k !== IMG };
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(old).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Pages: try the network first so updates show up, fall back to the cache offline.
// Everything else: cache first, then network (and remember it).
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    const url = new URL(req.url), page = url.origin + url.pathname;   // stored once, without ?utm=… extras
    e.respondWith(fetch(req).then(res => {
      try {   // saving a copy must never stop the fresh page from showing
        if (res.ok) e.waitUntil(plain(res.clone()).then(r => caches.open(VERSION).then(c => c.put(page, r))).catch(() => {}));
      } catch {}
      return res;
    }).catch(() => {
      // Offline.
      const root = self.registration.scope, home = url.href.split(/[?#]/)[0] === root;
      if (home) return own('./').then(r => r || own('index.html')).then(r => r || new Response(
        `<!doctype html><meta name="viewport" content="width=device-width"><title>Offline</title><p style="font:16px system-ui;padding:24px">You're offline, and this page hasn't been saved yet. Connect once and it will work offline after that.</p>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
      // /about/ -> /about, so the page's relative links (css/style.css) point to the stored files.
      const path = url.pathname.replace(/\/$/, '');
      if (path !== url.pathname) return Response.redirect(new URL(path + url.search, url).href, 302);
      // /about is stored as about.html (hosts like Cloudflare Pages drop the .html), so try that too.
      return own(page)
        .then(r => r || (/\/[^./]+$/.test(path) ? own(path + '.html') : null))
        // Anything else: go to the home page (served in place, its relative links would break).
        .then(r => r || Response.redirect(root, 302));
    }));
    return;
  }
  e.respondWith(own(req).then(hit => hit || caches.open(IMG).then(c => c.match(req))).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(req.url.includes('/assets/pokemon/') ? IMG : VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});

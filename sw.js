// Service worker: makes the site work offline after the first visit.
// Bump VERSION whenever you deploy changes so phones pick up the new files.
const VERSION = 'cbh-v24';
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

// New files are downloaded into a staging cache and moved into VERSION only once this worker takes over,
// so the running site never sees a mix of old and new files, and a failed install never touches its cache.
const STAGE = VERSION + '-staging';

self.addEventListener('install', e => {
  e.waitUntil(caches.delete(STAGE)
    .then(() => Promise.all(FILES.map(u => fetch(new Request(u, { cache: 'reload' })).then(res => {
      if (!res.ok) throw new Error(`Could not cache ${u}`);
      return plain(res);
    }))))
    .then(rs => caches.open(STAGE).then(c => Promise.all(rs.map((r, i) => c.put(FILES[i], r)))))
    .catch(err => caches.delete(STAGE).then(() => { throw err }))   // e.g. storage full: don't keep half
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.open(STAGE)
    .then(stage => stage.keys().then(reqs => caches.open(VERSION).then(live =>
      Promise.all(reqs.map(r => stage.match(r).then(res => live.put(r, res)))))))
    .then(() => caches.keys())
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== IMG).map(k => caches.delete(k))))  // staging, old versions, old icons
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
      if (home) return caches.match('./');
      // /about/ -> /about, so the page's relative links (css/style.css) point to the stored files.
      const path = url.pathname.replace(/\/$/, '');
      if (path !== url.pathname) return Response.redirect(new URL(path + url.search, url).href, 302);
      // /about is stored as about.html (hosts like Cloudflare Pages drop the .html), so try that too.
      return caches.match(page)
        .then(r => r || (/\/[^./]+$/.test(path) ? caches.match(path + '.html') : null))
        // Anything else: go to the home page (served in place, its relative links would break).
        .then(r => r || Response.redirect(root, 302));
    }));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(req.url.includes('/assets/pokemon/') ? IMG : VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});

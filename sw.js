// Service worker: makes the site work offline after the first visit.
// Bump VERSION whenever you deploy changes so phones pick up the new files.
const VERSION = 'cbh-v20';
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
const plain = res => res.redirected ? res.blob().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers })) : Promise.resolve(res);

self.addEventListener('install', e => {
  // Download everything first and store it only if every file arrived, so a dropped connection
  // never leaves a half-filled cache behind.
  e.waitUntil(Promise.all(FILES.map(u =>
    fetch(new Request(u, { cache: 'reload' })).then(res => {
      if (!res.ok) throw new Error(`Could not cache ${u}`);
      return plain(res);
    })
  )).then(rs => caches.open(VERSION).then(c => Promise.all(rs.map((r, i) => c.put(FILES[i], r)))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== IMG).map(k => caches.delete(k))))  // also drops old icon caches
    .then(() => self.clients.claim()));
});

// Pages: try the network first so updates show up, fall back to the cache offline.
// Everything else: cache first, then network (and remember it).
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        e.waitUntil(plain(copy).then(r => caches.open(VERSION).then(c => c.put(req, r))).catch(() => {}));
      }
      return res;
    }).catch(() => {
      // Offline. /about is stored as about.html (hosts like Cloudflare Pages drop the .html), so try that too.
      const path = new URL(req.url).pathname;
      return caches.match(req, { ignoreSearch: true })
        .then(r => r || (/\/[^./]+$/.test(path) ? caches.match(path + '.html') : null))
        .then(r => r || caches.match('./'));
    }));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(req.url.includes('/assets/pokemon/') ? IMG : VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});

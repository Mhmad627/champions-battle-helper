// Service worker: makes the site work offline after the first visit.
// Bump VERSION whenever you deploy changes so phones pick up the new files.
const VERSION = 'cbh-v10';
const TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
const FILES = [
  './', 'index.html', 'about.html', 'manifest.webmanifest',
  'css/style.css', 'js/data.js', 'js/app.js', 'js/team.js', 'js/theme.js',
  'data/pokemon.js', 'data/abilities.js', 'data/champions.js', 'data/sprites.js',
  'assets/fonts/bricolage-grotesque-latin.woff2',
  'assets/icons/icon-192.png', 'assets/icons/favicon-32.png',
  ...TYPES.map(t => `assets/types/${t}.webp`)
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Pages: try the network first so updates show up, fall back to the cache offline.
// Everything else: cache first, then network (and remember it).
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});

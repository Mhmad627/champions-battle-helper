// Service worker: makes the site work offline after the first visit.
// Bump VERSION whenever you deploy changes so phones pick up the new files.
const VERSION = 'cbh-v53';
// Pokémon icons are cached as they're seen, in a cache that survives normal deploys. Its name carries a
// fingerprint of the icons, written by tools/get_sprites.py, so rebuilt icons replace the old ones.
const IMG = 'cbh-icons-4aef74df';
const TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
const FILES = [
  './', 'index.html', 'about.html', 'manifest.webmanifest',
  'css/style.css', 'js/data.js', 'js/app.js', 'js/team.js', 'js/theme.js', 'js/update.js',
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

// Each deploy bumps VERSION (the tools do it too), so a new install fills a fresh cache that the running site
// never reads from: the site only ever looks in its own VERSION cache (and the icon cache).
const own = (req, opts) => caches.open(VERSION).then(c => c.match(req, opts));
const OURS = new Set(FILES.map(u => new URL(u, location).href));   // the only files kept in VERSION
// Download everything first and store it only if every file arrived.
const fill = () => Promise.all(FILES.map(u => fetch(new Request(u, { cache: 'reload' })).then(res => {
  if (!res.ok) throw new Error(`Could not cache ${u}`);
  return plain(res);
}))).then(rs => caches.open(VERSION).then(c => Promise.all(rs.map((r, i) => c.put(FILES[i], r)))));

self.addEventListener('install', e => {
  e.waitUntil(caches.has(VERSION).then(existed => fill()
    // e.g. storage full: don't keep a half-filled cache (unless it was there before this install)
    .catch(err => (existed ? Promise.resolve() : caches.delete(VERSION)).then(() => { throw err }))));
  // A new version then waits: open pages keep using the old one (offline too) until the person taps
  // Reload in the update banner (js/update.js), which sends 'skip-waiting'.
  // Versions up to cbh-v38 had no waiting step and their pages can't send that message, so when replacing one
  // of those, take over straight away as they did. From cbh-v39 on, every version waits (their pages have the
  // banner, so they can always switch).
  e.waitUntil(caches.keys().then(keys => {
    if (keys.some(k => { const m = /^cbh-v(\d+)$/.exec(k); return m && +m[1] <= 38 })) return self.skipWaiting();
  }));
});
self.addEventListener('message', e => { if (e.data === 'skip-waiting') self.skipWaiting() });

self.addEventListener('activate', e => {
  // Delete every other version (older ones, or newer ones left by a rollback) and old icon caches.
  const other = k => k.startsWith('cbh-icons-') ? k !== IMG : k !== VERSION;
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(other).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
  // If a file goes missing from the cache, it's fetched and stored again the next time it's needed online.
});

const OFFLINE = new Response(`<!doctype html><meta name="viewport" content="width=device-width"><title>Offline</title><p style="font:16px system-ui;padding:24px">You're offline, and this page hasn't been saved yet. Connect once and it will work offline after that.</p>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

// Everything, pages included, comes from this version's cache first, so a page always runs with the
// scripts and styles of its own version. A new deploy installs in the background and waits until the person taps
// Reload in the update banner (or every tab of the site is closed).
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    const url = new URL(req.url), root = new URL(self.registration.scope);
    const home = url.pathname === root.pathname || url.pathname === root.pathname + 'index.html';
    // Which stored page this is: /about is stored as about.html (hosts like Cloudflare Pages drop the .html).
    const path = url.pathname.replace(/\/$/, '');
    const key = home ? root.href : [url.origin + path, url.origin + path + '.html'].find(k => OURS.has(k));
    const goHome = () => Response.redirect(root.href, 302);   // by address, so its relative links work
    if (!home && path !== url.pathname) {
      // /about/: if it's a stored page, go to /about, so the page's relative links (css/style.css) point to
      // the stored files. Otherwise leave it to the server (some hosts add the slash themselves).
      e.respondWith(key ? Response.redirect(new URL(path + url.search, url).href, 302) : fetch(req).catch(goHome));
      return;
    }
    e.respondWith((key ? own(key) : Promise.resolve(null)).then(r => r || fetch(req).then(res => {
      // A stored page that went missing is saved again.
      if (key && res.ok) try { e.waitUntil(plain(res.clone()).then(c => caches.open(VERSION).then(v => v.put(key, c))).catch(() => {})) } catch {}
      return res;
    }, () => home ? OFFLINE.clone() : goHome())));   // offline and not stored
    return;
  }
  // Only the site's own files and the Pokémon icons are kept; anything else just goes to the network.
  const icon = req.url.includes('/assets/pokemon/'), store = icon ? IMG : OURS.has(req.url) ? VERSION : null;
  if (!store) return;
  // A missing site file is fetched fresh (not from the browser's own HTTP cache, which may hold an older one).
  e.respondWith(caches.open(store).then(c => c.match(req)).then(hit => hit || fetch(icon ? req : new Request(req, { cache: 'no-cache' })).then(res => {
    if (res.ok) {
      const copy = res.clone();
      try { e.waitUntil(caches.open(store).then(c => c.put(req, copy)).catch(() => {})) } catch {}
    }
    return res;
  })));
});

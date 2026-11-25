'use strict';
/* Offline support and the update banner, shared by index.html and about.html.
   A new version downloads in the background and then waits (see sw.js). While it waits, a small banner
   offers to reload. It never reloads by itself, so nobody loses their place mid-battle. If the banner is
   closed, it comes back on the next visit for as long as an update is waiting. */
(() => {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const sw = navigator.serviceWorker;
  const CHECK_EVERY = 30 * 60 * 1000;   // look for updates at most every 30 minutes when the tab comes back
  const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  let hadWorker = !!sw.controller;   // set again below: after a hard refresh there's a worker but no controller
  let reg = null, lastCheck = Date.now(), lastFocus = null, reloading = false;

  // The banner's own live region, added now (empty) so screen readers are already watching it when it's filled.
  const live = document.createElement('p'); live.className = 'sr'; live.setAttribute('aria-live', 'polite');
  document.body.append(live);
  const say = text => { live.textContent = ''; setTimeout(() => { live.textContent = text }, 50) };   // cleared first so a repeat is read too
  // Pages with the phone tab bar place the banner above it (a class, so older browsers without :has() work too).
  if (document.querySelector('.tabbar')) document.body.classList.add('has-tabbar');
  // Remember where keyboard focus was before it moved into the banner, to put it back on close.
  document.addEventListener('focusin', e => { if (!e.target.closest('#update')) lastFocus = e.target });

  function reload(){ if (!reloading){ reloading = true; location.reload() } }
  function show(){
    if (document.getElementById('update')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="update" id="update"><span>A new version is ready.</span><button class="btn" id="updateGo">Reload</button><button class="update-x" id="updateX" aria-label="Not now">${X}</button></div>`);
    document.body.classList.add('has-update');
    say('A new version of the site is ready. Reload to use it.');
    document.getElementById('updateGo').addEventListener('click', () => {
      const waiting = reg && reg.waiting;
      if (!waiting){ reload(); return }
      // Switch to the new version, then reload once it has taken over (or after 3 seconds regardless).
      sw.addEventListener('controllerchange', reload, { once: true });
      waiting.postMessage('skip-waiting');
      // If an even newer version replaced that one meanwhile, ask that one instead. Otherwise just wait:
      // the reload happens when the switch does, and the banner stays up until then.
      setTimeout(() => {
        if (!reloading && reg.waiting && reg.waiting !== waiting) reg.waiting.postMessage('skip-waiting');
      }, 3000);
    });
    document.getElementById('update').addEventListener('keydown', e => { if (e.key === 'Escape'){ e.stopPropagation(); document.getElementById('updateX').click() } });
    document.getElementById('updateX').addEventListener('click', () => {
      const bar = document.getElementById('update'), hadFocus = bar.contains(document.activeElement);
      bar.remove(); document.body.classList.remove('has-update');
      if (!hadFocus) return;
      const seen = el => el && document.contains(el) && el.getClientRects().length > 0;   // still there and visible
      const to = [lastFocus, document.getElementById('q')].find(seen) || document.querySelector('main');
      if (to){ if (to.tagName === 'MAIN') to.tabIndex = -1; to.focus({ preventScroll: true }) }
    });
  }
  // A version is waiting while an older one is running: offer it.
  const check = () => { if (reg && reg.waiting && reg.active) show() };
  const watch = w => { if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') check() }) };

  // Another tab tapped Reload, so the new version now runs this page too: offer a reload here as well.
  // (The very first switch, when the site is first installed, isn't an update: just note it.)
  sw.addEventListener('controllerchange', () => { if (!hadWorker){ hadWorker = true; return } if (!reloading) show() });

  addEventListener('load', () => sw.register('sw.js').then(r => {
    reg = r; if (r.active) hadWorker = true; check();
    watch(r.installing);                                   // an update that started while the page loaded
    r.addEventListener('updatefound', () => watch(r.installing));
    // Phones keep the site open for hours: look for an update when it comes back on screen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_EVERY) return;
      lastCheck = Date.now(); r.update().catch(() => {});
    });
  }).catch(() => {}));
})();

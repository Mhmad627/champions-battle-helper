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
  let reg = null, lastCheck = Date.now(), lastFocus = null;

  // Tell screen readers through a live region that's already on the page (filled after a moment, so it's read).
  function say(text){
    let el = document.getElementById('announce');
    if (!el){ el = document.createElement('p'); el.id = 'announce'; el.className = 'sr'; el.setAttribute('aria-live', 'polite'); document.body.append(el) }
    el.textContent = ''; setTimeout(() => { el.textContent = text }, 50);
  }
  // Remember where keyboard focus was before it moved into the banner, to put it back on close.
  document.addEventListener('focusin', e => { if (!e.target.closest('#update')) lastFocus = e.target });

  function show(){
    if (document.getElementById('update')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="update" id="update"><span>A new version is ready.</span><button class="btn" id="updateGo">Reload</button><button class="update-x" id="updateX" aria-label="Not now">${X}</button></div>`);
    document.body.classList.add('has-update');
    say('A new version of the site is ready. Reload to use it.');
    document.getElementById('updateGo').addEventListener('click', () => {
      const waiting = reg && reg.waiting;
      if (!waiting){ location.reload(); return }
      // Switch to the new version, then reload once it has taken over.
      sw.addEventListener('controllerchange', () => location.reload(), { once: true });
      waiting.postMessage('skip-waiting');
    });
    document.getElementById('updateX').addEventListener('click', () => {
      const hadFocus = document.getElementById('update').contains(document.activeElement);
      document.getElementById('update').remove(); document.body.classList.remove('has-update');
      if (hadFocus && lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    });
  }
  // A version is waiting while an older one is running: offer it.
  const check = () => { if (reg && reg.waiting && reg.active) show() };

  addEventListener('load', () => sw.register('sw.js').then(r => {
    reg = r; check();
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') check() });
    });
    // Phones keep the site open for hours: look for an update when it comes back on screen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_EVERY) return;
      lastCheck = Date.now(); r.update().catch(() => {});
    });
  }).catch(() => {}));
})();

/* Light / dark theme button, shared by every page. The saved choice (or the system setting) is applied
   early by an inline script in each page's <head>, so there's no flash of the wrong theme. */
(() => {
  const r = document.documentElement, meta = document.querySelector('meta[name=theme-color]');
  const btn = document.getElementById('theme');
  const sync = () => {
    const light = r.dataset.theme === 'light';
    if (meta) meta.content = light ? '#EDF0F8' : '#1A2140';
    if (btn) btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
  };
  sync();
  btn?.addEventListener('click', () => {
    r.dataset.theme = r.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('tcs-theme', r.dataset.theme) } catch {}
    sync();
  });
  // Follow the system setting while it's open, unless a theme was picked with the button.
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', e => {
    let saved = null; try { saved = localStorage.getItem('tcs-theme') } catch {}
    if (!saved){ r.dataset.theme = e.matches ? 'light' : 'dark'; sync() }
  });
})();

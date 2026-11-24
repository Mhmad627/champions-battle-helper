/* Light / dark theme button, shared by every page. The saved choice is applied early by an inline
   script in each page's <head>, so there's no flash of the wrong theme. */
(() => {
  const r = document.documentElement, meta = document.querySelector('meta[name=theme-color]');
  const sync = () => { if (meta) meta.content = r.dataset.theme === 'light' ? '#EDF0F8' : '#1A2140' };
  sync();
  document.getElementById('theme')?.addEventListener('click', () => {
    r.dataset.theme = r.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('tcs-theme', r.dataset.theme) } catch {}
    sync();
  });
})();

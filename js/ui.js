/* Оформлення: тема, hero-блок, інтерактивна монета. Логіку каталогу не зачіпає. */
(function () {
  'use strict';
  const root = document.documentElement;

  /* ---------- Тема ---------- */
  const toggle = document.querySelector('[data-theme-toggle]');
  const syncLabel = () => {
    if (!toggle) return;
    const dark = root.dataset.theme === 'dark';
    toggle.setAttribute('aria-label', dark ? 'Світла тема' : 'Темна тема');
    toggle.setAttribute('aria-pressed', String(dark));
  };
  syncLabel();
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      const apply = () => {
        root.dataset.theme = next;
        try { localStorage.setItem('coinua:theme', next); } catch (e) { /* приватний режим */ }
        syncLabel();
      };
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(apply);
      else apply();
    });
  }

  /* ---------- Hero: цифри з каталогу ---------- */
  const cat = window.CATALOG;
  if (cat) {
    const set = (key, val) => document.querySelectorAll(`[data-stat="${key}"]`).forEach((el) => { el.textContent = val; });
    const fmt = new Intl.NumberFormat('uk-UA');
    set('items', fmt.format(cat.items.length));
    set('inStock', fmt.format(cat.items.filter((it) => it.stock > 0).length));
    const years = cat.items.map((it) => it.year).filter(Boolean);
    if (years.length) set('years', fmt.format(new Date().getFullYear() - Math.min(...years)));
    set('cats', cat.categories.length);
  }

  /* Швидкі посилання на категорії */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto-cat]');
    if (!b) return;
    const tab = document.querySelector(`#tabs [data-cat="${b.dataset.gotoCat}"]`);
    if (tab) tab.click();
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- Монета нахиляється за курсором ---------- */
  const stage = document.querySelector('.hero-coin');
  const coin = stage && stage.querySelector('.coin3d');
  if (coin && matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches) {
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      coin.style.transform = `rotateY(${x * 40}deg) rotateX(${-y * 30}deg)`;
    });
    stage.addEventListener('pointerleave', () => { coin.style.transform = ''; });
  }
})();

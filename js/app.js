(function () {
  'use strict';

  const { categories, periods, grades, metals, items } = window.CATALOG;
  const byId = new Map(items.map((it) => [it.id, it]));
  const MAX_COMPARE = 4;
  const fmt = new Intl.NumberFormat('uk-UA');
  const money = (n) => fmt.format(n) + ' ₴';
  const $ = (sel, root = document) => root.querySelector(sel);

  /* ---------- Збереження ---------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('coinua:' + key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('coinua:' + key, JSON.stringify(value)); } catch (e) { /* приватний режим */ }
    }
  };

  /* ---------- Стан ---------- */
  const state = {
    cat: 'coins',
    query: '',
    periods: new Set(),
    yearFrom: null,
    yearTo: null,
    grades: new Set(),
    priceMax: null,
    inStock: false,
    notOwned: false,
    metal: 'all',
    sort: 'new',
    view: store.get('view', 'grid'),
    onlyFav: false,
    onlyOwned: false,
    compare: new Set(),
    cart: store.get('cart', {}),
    fav: new Set(store.get('fav', [])),
    owned: new Set(store.get('owned', []))
  };

  /* Обране та колекція: у гостя — в localStorage, у користувача — в його акаунті. */
  const Auth = window.Auth;
  const loggedIn = () => !!(Auth && Auth.user);
  let syncTimer;

  const persist = () => {
    store.set('cart', state.cart);
    store.set('view', state.view);
    if (loggedIn()) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        Auth.updateData({ fav: [...state.fav], owned: [...state.owned] })
          .catch((e) => toast('Не вдалося зберегти: ' + e.message));
      }, 400);
    } else {
      store.set('fav', [...state.fav]);
      store.set('owned', [...state.owned]);
    }
  };

  if (Auth) {
    Auth.on((user, event) => {
      if (event === 'data' || event === 'profile') return; // наші власні збереження
      if (user) {
        // Переносимо в акаунт те, що гість встиг додати до входу.
        const guestFav = store.get('fav', []);
        const guestOwned = store.get('owned', []);
        state.fav = new Set([...(user.data.fav || []), ...guestFav]);
        state.owned = new Set([...(user.data.owned || []), ...guestOwned]);
        if (guestFav.length || guestOwned.length) {
          store.set('fav', []);
          store.set('owned', []);
          persist();
        }
      } else {
        state.fav = new Set(store.get('fav', []));
        state.owned = new Set(store.get('owned', []));
        state.onlyFav = false;
        state.onlyOwned = false;
      }
      refresh();
      if (cartOpen && cartStep === 'checkout') renderCart();
    });
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Зображення предметів (CSS-заглушки до появи фото) ---------- */
  function visual(it) {
    if (it.image) return `<img src="${esc(it.image)}" alt="" loading="lazy">`;
    switch (it.cat) {
      case 'banknotes': return `<div class="note" style="--h:${Number(it.hue) || 40}"></div>`;
      case 'sets': return `<div class="set">${'<i></i>'.repeat(6)}</div>`;
      case 'accessories': return '<div class="album"></div>';
      default: return `<div class="coin ${it.metal === 'mixed' ? 'silver' : esc(it.metal)}"></div>`;
    }
  }

  const heartSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

  /* ---------- Фільтрація ---------- */
  const inCategory = () => items.filter((it) => it.cat === state.cat);

  function matches(it, skip) {
    if (it.cat !== state.cat) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      const hay = [it.name, it.code, it.year, metals[it.metal], it.grade, it.desc].join(' ').toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    if (state.periods.size && !state.periods.has(it.period)) return false;
    if (state.yearFrom != null && it.year < state.yearFrom) return false;
    if (state.yearTo != null && it.year > state.yearTo) return false;
    if (state.grades.size && !state.grades.has(it.grade)) return false;
    if (state.priceMax != null && it.price > state.priceMax) return false;
    if (state.inStock && it.stock < 1) return false;
    if (state.notOwned && state.owned.has(it.id)) return false;
    if (skip !== 'metal' && state.metal !== 'all' && it.metal !== state.metal) return false;
    if (state.onlyFav && !state.fav.has(it.id)) return false;
    if (state.onlyOwned && !state.owned.has(it.id)) return false;
    return true;
  }

  const sorters = {
    'new': (a, b) => b.year - a.year || a.name.localeCompare(b.name, 'uk'),
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    'year-asc': (a, b) => a.year - b.year,
    'year-desc': (a, b) => b.year - a.year,
    'name': (a, b) => a.name.localeCompare(b.name, 'uk')
  };

  /* ---------- Рендер: категорії та фільтри ---------- */
  function renderTabs() {
    $('#tabs').innerHTML = categories.map((c) =>
      `<button type="button" class="tab" data-cat="${c.id}" ${c.id === state.cat ? 'aria-current="page"' : ''}>${esc(c.label)}</button>`
    ).join('');
    const cat = categories.find((c) => c.id === state.cat);
    let title = cat.title;
    if (state.onlyFav) title = 'Обране: ' + cat.label.toLowerCase();
    if (state.onlyOwned) title = 'Моя колекція: ' + cat.label.toLowerCase();
    $('#pageTitle').textContent = title;
    $('#crumbs').textContent = 'Каталог / ' + cat.label;
    document.title = cat.title + ' — CoinUA';
  }

  function renderFilters() {
    const pool = inCategory();
    $('#periodList').innerHTML = periods.map((p) => {
      const n = pool.filter((it) => it.period === p.id).length;
      return `<label class="check"><input type="checkbox" data-period="${p.id}" ${state.periods.has(p.id) ? 'checked' : ''}> ${esc(p.label)} <span class="num">${n}</span></label>`;
    }).join('');

    $('#gradeList').innerHTML = grades.map((g) =>
      `<button type="button" class="pill" data-grade="${g}" aria-pressed="${state.grades.has(g)}">${g}</button>`
    ).join('');

    const max = Math.max(...pool.map((it) => it.price), 0);
    const range = $('#priceMax');
    range.min = 0;
    range.max = max;
    range.step = Math.max(1, Math.round(max / 200));
    range.value = state.priceMax ?? max;
    $('#priceOut').textContent = 'до ' + money(state.priceMax ?? max);

    $('#yearFrom').value = state.yearFrom ?? '';
    $('#yearTo').value = state.yearTo ?? '';
    $('#inStock').checked = state.inStock;
    $('#notOwned').checked = state.notOwned;
  }

  function renderMetalChips() {
    const present = new Set(items.filter((it) => matches(it, 'metal')).map((it) => it.metal));
    inCategory().forEach((it) => present.add(it.metal));
    if (state.metal !== 'all' && !present.has(state.metal)) state.metal = 'all';
    const list = [['all', 'Усі'], ...Object.entries(metals).filter(([k]) => present.has(k))];
    $('#metalChips').innerHTML = list.map(([k, label]) =>
      `<button type="button" class="chip" data-metal="${k}" aria-pressed="${state.metal === k}">${esc(label)}</button>`
    ).join('');
  }

  function renderActiveFilters() {
    const tags = [];
    if (state.query) tags.push(['query', `«${state.query}»`]);
    state.periods.forEach((p) => tags.push(['period:' + p, periods.find((x) => x.id === p).label]));
    if (state.yearFrom != null) tags.push(['yearFrom', 'від ' + state.yearFrom]);
    if (state.yearTo != null) tags.push(['yearTo', 'до ' + state.yearTo]);
    state.grades.forEach((g) => tags.push(['grade:' + g, g]));
    if (state.priceMax != null) tags.push(['priceMax', 'до ' + money(state.priceMax)]);
    if (state.inStock) tags.push(['inStock', 'В наявності']);
    if (state.notOwned) tags.push(['notOwned', 'Немає в колекції']);
    if (state.metal !== 'all') tags.push(['metal', metals[state.metal]]);
    if (state.onlyFav) tags.push(['onlyFav', 'Лише обране']);
    if (state.onlyOwned) tags.push(['onlyOwned', 'Лише моя колекція']);
    $('#activeFilters').innerHTML = tags.map(([key, label]) =>
      `<button type="button" class="tag" data-remove="${esc(key)}" aria-label="Прибрати фільтр: ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`
    ).join('');
  }

  /* ---------- Рендер: результати ---------- */
  function cardHtml(it) {
    const fav = state.fav.has(it.id);
    const owned = state.owned.has(it.id);
    const out = it.stock < 1;
    return `
      <article class="card">
        <button type="button" class="fav-btn" data-action="fav" data-id="${it.id}" aria-pressed="${fav}" aria-label="${fav ? 'Прибрати з обраного' : 'Додати в обране'}: ${esc(it.name)}">${heartSvg}</button>
        <button type="button" class="card-media" data-action="open" data-id="${it.id}" aria-label="Детальніше: ${esc(it.name)}">
          ${visual(it)}
          ${out ? '<span class="badge out">Немає</span>' : ''}
          ${owned ? '<span class="badge owned">У колекції</span>' : ''}
        </button>
        <div class="card-meta"><span>${esc(it.code)}</span><span>${esc(it.grade)}</span></div>
        <h3><button type="button" data-action="open" data-id="${it.id}">${esc(it.name)}</button></h3>
        <dl class="specs">
          <dt>Матеріал</dt><dd>${esc(metals[it.metal])}</dd>
          <dt>Рік</dt><dd class="mono">${it.year}</dd>
        </dl>
        <div class="card-foot">
          <span class="price">${money(it.price)}</span>
          <label class="cmp"><input type="checkbox" data-action="compare" data-id="${it.id}" ${state.compare.has(it.id) ? 'checked' : ''}> Порівняти</label>
        </div>
        <div class="card-actions">
          ${out
            ? `<button type="button" class="btn btn-outline" data-action="notify" data-id="${it.id}">Повідомити</button>`
            : `<button type="button" class="btn btn-primary" data-action="cart" data-id="${it.id}">${state.cart[it.id] ? 'У кошику · ' + state.cart[it.id] : 'У кошик'}</button>`}
        </div>
      </article>`;
  }

  function rowHtml(it) {
    const out = it.stock < 1;
    return `
      <tr>
        <td><div class="thumb-cell"><div class="thumb">${visual(it)}</div></div></td>
        <td class="mono">${esc(it.code)}</td>
        <td><button type="button" class="name-btn" data-action="open" data-id="${it.id}">${esc(it.name)}</button></td>
        <td>${esc(metals[it.metal])}</td>
        <td class="mono">${it.year}</td>
        <td class="mono">${esc(it.grade)}</td>
        <td class="mono" style="color:var(--ink);font-weight:600">${money(it.price)}</td>
        <td>${out
          ? `<button type="button" class="btn btn-outline" data-action="notify" data-id="${it.id}">Повідомити</button>`
          : `<button type="button" class="btn btn-primary" data-action="cart" data-id="${it.id}">У кошик</button>`}</td>
      </tr>`;
  }

  function renderResults() {
    const list = items.filter((it) => matches(it)).sort(sorters[state.sort]);
    $('#resultCount').textContent = list.length + ' ' + plural(list.length, ['позиція', 'позиції', 'позицій']);
    const isGrid = state.view === 'grid';
    $('#grid').hidden = !isGrid || !list.length;
    $('#tableWrap').hidden = isGrid || !list.length;
    $('#empty').hidden = list.length > 0;
    if (isGrid) $('#grid').innerHTML = list.map(cardHtml).join('');
    else $('#tableBody').innerHTML = list.map(rowHtml).join('');
    document.querySelectorAll('.segmented button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  }

  function plural(n, forms) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }

  function renderCounters() {
    const cartCount = Object.values(state.cart).reduce((a, b) => a + b, 0);
    document.querySelectorAll('[data-count="cart"]').forEach((el) => { el.textContent = cartCount; });
    document.querySelectorAll('[data-count="fav"]').forEach((el) => { el.textContent = state.fav.size; });
    document.querySelectorAll('[data-count="collection"]').forEach((el) => { el.textContent = state.owned.size; });
    $('#favBtn').setAttribute('aria-pressed', String(state.onlyFav));
    $('#collectionBtn').setAttribute('aria-pressed', String(state.onlyOwned));
    $('#compareBar').hidden = state.compare.size === 0;
    $('#compareCount').textContent = state.compare.size;
    document.body.style.paddingBottom = state.compare.size ? '72px' : '';
  }

  function renderAll() {
    renderTabs();
    renderFilters();
    renderMetalChips();
    renderActiveFilters();
    renderResults();
    renderCounters();
  }

  function refresh() {
    renderMetalChips();
    renderActiveFilters();
    renderResults();
    renderCounters();
    renderTabs();
  }

  /* ---------- Повідомлення ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  /* ---------- Дії з товаром ---------- */
  function addToCart(id, qty = 1) {
    const it = byId.get(id);
    const current = state.cart[id] || 0;
    if (current + qty > it.stock) { toast('Більше немає в наявності'); return; }
    state.cart[id] = current + qty;
    persist();
    toast('Додано в кошик: ' + it.name);
    refresh();
    if (cartOpen) renderCart();
  }

  function toggleFav(id) {
    state.fav.has(id) ? state.fav.delete(id) : state.fav.add(id);
    persist();
    refresh();
  }

  function toggleOwned(id) {
    state.owned.has(id) ? state.owned.delete(id) : state.owned.add(id);
    persist();
    refresh();
  }

  function toggleCompare(id, input) {
    if (state.compare.has(id)) state.compare.delete(id);
    else if (state.compare.size >= MAX_COMPARE) {
      if (input) input.checked = false;
      toast('Можна порівняти до ' + MAX_COMPARE + ' предметів');
      return;
    } else state.compare.add(id);
    renderCounters();
  }

  /* ---------- Картка товару ---------- */
  const productDialog = $('#productDialog');

  function openProduct(id) {
    const it = byId.get(id);
    const cat = categories.find((c) => c.id === it.cat);
    const period = periods.find((p) => p.id === it.period);
    const out = it.stock < 1;
    const owned = state.owned.has(id);
    const fav = state.fav.has(id);
    $('#productBody').innerHTML = `
      <div class="dialog-head">
        <span class="crumbs" style="margin:0">${esc(cat.label)} / ${esc(it.code)}</span>
        <button type="button" class="icon-btn" data-close aria-label="Закрити">✕</button>
      </div>
      <div class="pd">
        <div class="pd-media big">${visual(it)}</div>
        <div class="pd-info">
          <h2 id="pdTitle">${esc(it.name)}</h2>
          <p style="margin:0;color:var(--muted)">${esc(it.desc)}</p>
          <dl class="specs">
            <dt>Матеріал</dt><dd>${esc(metals[it.metal])}</dd>
            <dt>Період</dt><dd>${esc(period.label)}</dd>
            <dt>Рік</dt><dd class="mono">${it.year}</dd>
            <dt>Стан</dt><dd class="mono">${esc(it.grade)}</dd>
            <dt>Вага / склад</dt><dd>${esc(it.weight)}</dd>
            <dt>Розмір</dt><dd>${esc(it.diameter)}</dd>
            <dt>Гурт</dt><dd>${esc(it.edge)}</dd>
          </dl>
          <div class="pd-price">${money(it.price)}</div>
          <div class="${out ? 'stock-no' : 'stock-ok'}">${out ? 'Немає в наявності' : 'В наявності: ' + it.stock + ' шт.'}</div>
          <div class="pd-actions">
            ${out
              ? `<button type="button" class="btn btn-primary" data-action="notify" data-id="${id}">Повідомити про надходження</button>`
              : `<button type="button" class="btn btn-primary" data-action="cart" data-id="${id}">Додати в кошик</button>`}
            <button type="button" class="btn btn-outline" data-action="fav" data-id="${id}" aria-pressed="${fav}">${fav ? 'В обраному' : 'В обране'}</button>
          </div>
          <label class="check"><input type="checkbox" data-action="owned" data-id="${id}" ${owned ? 'checked' : ''}> Є в моїй колекції</label>
        </div>
      </div>`;
    if (!productDialog.open) productDialog.showModal();
  }

  /* ---------- Порівняння ---------- */
  const compareDialog = $('#compareDialog');

  function openCompare() {
    const list = [...state.compare].map((id) => byId.get(id));
    const rows = [
      ['Код', (it) => it.code],
      ['Категорія', (it) => categories.find((c) => c.id === it.cat).label],
      ['Матеріал', (it) => metals[it.metal]],
      ['Період', (it) => periods.find((p) => p.id === it.period).label],
      ['Рік', (it) => it.year],
      ['Стан', (it) => it.grade],
      ['Вага / склад', (it) => it.weight],
      ['Розмір', (it) => it.diameter],
      ['Гурт', (it) => it.edge],
      ['Ціна', (it) => money(it.price)],
      ['Наявність', (it) => (it.stock > 0 ? it.stock + ' шт.' : 'Немає')]
    ];
    const head = `<tr><th></th>${list.map((it) => `<th><div class="thumb-cell" style="width:100%;height:90px"><div style="transform:scale(.6)">${visual(it)}</div></div><div style="text-transform:none;font-family:var(--sans);font-size:14px;color:var(--ink);font-weight:600;letter-spacing:0;white-space:normal">${esc(it.name)}</div></th>`).join('')}</tr>`;
    const body = rows.map(([label, get]) => {
      const vals = list.map(get);
      const diff = new Set(vals.map(String)).size > 1;
      return `<tr class="${diff ? 'diff' : ''}"><td>${label}</td>${vals.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`;
    }).join('');
    const actions = `<tr><td></td>${list.map((it) => `<td>${it.stock > 0 ? `<button type="button" class="btn btn-primary" data-action="cart" data-id="${it.id}">У кошик</button>` : ''}</td>`).join('')}</tr>`;
    $('#compareTable').innerHTML = `<table class="table compare-table"><thead>${head}</thead><tbody>${body}${actions}</tbody></table><p class="small" style="padding:0 14px">Жовтим підсвічено рядки, де предмети відрізняються.</p>`;
    compareDialog.showModal();
  }

  /* ---------- Кошик і оформлення ---------- */
  const drawer = $('#cartDrawer');
  const backdrop = $('#drawerBackdrop');
  let cartOpen = false;
  let cartStep = 'cart';
  let lastFocus = null;

  function openCart() {
    cartOpen = true;
    cartStep = 'cart';
    lastFocus = document.activeElement;
    renderCart();
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false;
    $('#cartClose').focus();
  }

  function closeCart() {
    cartOpen = false;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    if (lastFocus) lastFocus.focus();
  }

  const cartTotal = () => Object.entries(state.cart).reduce((sum, [id, q]) => sum + byId.get(id).price * q, 0);

  function renderCart() {
    const el = $('#cartContent');
    const entries = Object.entries(state.cart).filter(([id]) => byId.has(id));

    if (cartStep === 'done') return;
    if (!entries.length) {
      $('#drawerTitle').textContent = 'Кошик';
      el.innerHTML = '<p style="color:var(--muted)">Кошик порожній. Додайте монети, набори чи банкноти з каталогу.</p><button type="button" class="btn btn-outline" data-cart="close">До каталогу</button>';
      return;
    }

    if (cartStep === 'cart') {
      $('#drawerTitle').textContent = 'Кошик';
      el.innerHTML = entries.map(([id, q]) => {
        const it = byId.get(id);
        return `<div class="cart-item">
          <div class="thumb-cell"><div class="thumb" style="transform:scale(.4)">${visual(it)}</div></div>
          <div>
            <div class="name">${esc(it.name)}</div>
            <div class="small mono">${esc(it.code)} · ${esc(it.grade)}</div>
            <div class="qty" role="group" aria-label="Кількість">
              <button type="button" data-cart="dec" data-id="${id}" aria-label="Зменшити">−</button>
              <span>${q}</span>
              <button type="button" data-cart="inc" data-id="${id}" aria-label="Збільшити">+</button>
            </div>
          </div>
          <div style="text-align:right">
            <div class="price">${money(it.price * q)}</div>
            <button type="button" class="remove" data-cart="remove" data-id="${id}">Видалити</button>
          </div>
        </div>`;
      }).join('') + `
        <div class="cart-total"><span>Разом</span><b>${money(cartTotal())}</b></div>
        <p class="small" style="margin:0">Доставка розраховується за тарифами перевізника. Кожен предмет — із сертифікатом автентичності.</p>
        <button type="button" class="btn btn-primary btn-block" data-cart="checkout">Оформити замовлення</button>`;
      return;
    }

    // Крок оформлення
    const u = loggedIn() ? Auth.user : null;
    const d = (u && u.data) || {};
    const phoneVal = d.contactPhone || (u && u.phone ? Auth.formatPhone(u.phone) : '');
    $('#drawerTitle').textContent = 'Оформлення';
    el.innerHTML = `
      ${u
        ? `<p class="auth-note" style="margin:0">Замовлення збережеться в <a href="account.html#orders">особистому кабінеті</a>.</p>`
        : `<p class="auth-note" style="margin:0">Є акаунт? <button type="button" class="link-btn accent" data-open-auth="login" style="min-height:0;padding:0">Увійдіть</button>, щоб дані заповнилися самі, а замовлення з’явилося в кабінеті.</p>`}
      <form class="form" id="checkoutForm" novalidate>
        <label class="field">Ім’я та прізвище<input name="name" required autocomplete="name" placeholder="Ім’я Прізвище" value="${esc(u ? u.name : '')}"></label>
        <label class="field">Телефон<input name="phone" type="tel" required autocomplete="tel" placeholder="+380 XX XXX XX XX" pattern="\\+?[0-9 ]{10,17}" value="${esc(phoneVal)}"></label>
        <label class="field">Ел. пошта (необов’язково)<input name="email" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(u && u.email ? u.email : '')}"></label>
        <fieldset class="radio-group">
          <legend>Доставка</legend>
          <label class="radio"><input type="radio" name="delivery" value="np" checked> Нова Пошта — відділення</label>
          <label class="radio"><input type="radio" name="delivery" value="np-courier"> Нова Пошта — кур’єр</label>
          <label class="radio"><input type="radio" name="delivery" value="up"> Укрпошта</label>
          <label class="radio"><input type="radio" name="delivery" value="pickup"> Самовивіз із шоуруму</label>
        </fieldset>
        <div id="addressFields" class="form">
          <label class="field">Місто<input name="city" required autocomplete="address-level2" placeholder="Київ" value="${esc(d.city || '')}"></label>
          <label class="field">Відділення або адреса<input name="branch" required placeholder="№ відділення" value="${esc(d.branch || '')}"></label>
          ${u ? '<label class="check"><input type="checkbox" name="saveAddress" checked> Зберегти адресу в профілі</label>' : ''}
        </div>
        <fieldset class="radio-group">
          <legend>Оплата</legend>
          <label class="radio"><input type="radio" name="pay" value="card" checked> Карткою онлайн / Apple Pay / Google Pay</label>
          <label class="radio"><input type="radio" name="pay" value="cod"> Під час отримання</label>
          <label class="radio"><input type="radio" name="pay" value="invoice"> Рахунок для юридичних осіб</label>
        </fieldset>
        <div class="cart-total"><span>До сплати</span><b>${money(cartTotal())}</b></div>
        <button type="submit" class="btn btn-primary btn-block">Підтвердити замовлення</button>
        <button type="button" class="btn btn-outline btn-block" data-cart="back">Назад до кошика</button>
      </form>`;
  }

  function submitOrder(form) {
    const pickup = form.delivery.value === 'pickup';
    form.city.required = !pickup;
    form.branch.required = !pickup;
    if (!form.reportValidity()) return;
    const labelOf = (name) => {
      const input = form.querySelector(`input[name="${name}"]:checked`);
      return input ? input.parentElement.textContent.trim() : '';
    };
    const order = {
      id: 'CU-' + Date.now().toString().slice(-6),
      date: new Date().toISOString(),
      status: 'Прийнято',
      items: Object.entries(state.cart).map(([id, qty]) => {
        const it = byId.get(id);
        return { id, code: it.code, name: it.name, qty, price: it.price };
      }),
      total: cartTotal(),
      delivery: labelOf('delivery'),
      payment: labelOf('pay'),
      address: pickup ? '' : [form.city.value.trim(), form.branch.value.trim()].filter(Boolean).join(', ')
    };

    if (loggedIn()) {
      const d = Auth.user.data || {};
      const patch = { orders: [order, ...(d.orders || [])].slice(0, 50), contactPhone: form.phone.value.trim() };
      if (!pickup && form.saveAddress && form.saveAddress.checked) {
        patch.city = form.city.value.trim();
        patch.branch = form.branch.value.trim();
      }
      Auth.updateData(patch).catch((e) => toast('Замовлення не збережено в кабінеті: ' + e.message));
    }

    state.cart = {};
    persist();
    cartStep = 'done';
    $('#drawerTitle').textContent = 'Дякуємо!';
    $('#cartContent').innerHTML = `
      <div class="success">
        <div class="check-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></div>
        <h3 style="margin:0;font-size:22px">Замовлення ${order.id} прийнято</h3>
        <p style="margin:0;color:var(--muted)">Менеджер зателефонує для підтвердження. Це демо-версія: замовлення нікуди не надсилається.</p>
        ${loggedIn() ? '<a class="btn btn-primary" href="account.html#orders">Мої замовлення</a>' : ''}
        <button type="button" class="btn btn-outline" data-cart="close">Продовжити покупки</button>
      </div>`;
    refresh();
  }

  /* ---------- Обробники ---------- */
  function resetFilters() {
    Object.assign(state, { query: '', yearFrom: null, yearTo: null, priceMax: null, inStock: false, notOwned: false, metal: 'all', onlyFav: false, onlyOwned: false });
    state.periods.clear();
    state.grades.clear();
    $('#search').value = '';
    renderAll();
  }

  function handleItemAction(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    if (action === 'open') openProduct(id);
    else if (action === 'fav') { toggleFav(id); if (productDialog.open) openProduct(id); }
    else if (action === 'cart') addToCart(id);
    else if (action === 'notify') toast('Повідомимо, щойно предмет з’явиться в наявності');
    else if (action === 'reset') resetFilters();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#results, #productDialog, #compareDialog')) {
      if (e.target.matches('input[type="checkbox"][data-action]')) return; // обробляється в change
      handleItemAction(e);
    }
    if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-action="compare"]')) toggleCompare(t.dataset.id, t);
    if (t.matches('[data-action="owned"]')) toggleOwned(t.dataset.id);
  });

  // Закриття діалогу кліком по затемненню
  [productDialog, compareDialog].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b || b.dataset.cat === state.cat) return;
    state.cat = b.dataset.cat;
    state.periods.clear();
    state.grades.clear();
    state.priceMax = null;
    state.metal = 'all';
    renderAll();
  });

  let searchTimer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.query = e.target.value.trim(); refresh(); }, 180);
  });

  $('#periodList').addEventListener('change', (e) => {
    const p = e.target.dataset.period;
    if (!p) return;
    e.target.checked ? state.periods.add(p) : state.periods.delete(p);
    refresh();
  });

  $('#gradeList').addEventListener('click', (e) => {
    const g = e.target.closest('[data-grade]');
    if (!g) return;
    const v = g.dataset.grade;
    state.grades.has(v) ? state.grades.delete(v) : state.grades.add(v);
    g.setAttribute('aria-pressed', String(state.grades.has(v)));
    refresh();
  });

  const yearInput = (key) => (e) => {
    const v = parseInt(e.target.value, 10);
    state[key] = Number.isFinite(v) ? v : null;
    refresh();
  };
  $('#yearFrom').addEventListener('change', yearInput('yearFrom'));
  $('#yearTo').addEventListener('change', yearInput('yearTo'));

  $('#priceMax').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    state.priceMax = v >= Number(e.target.max) ? null : v;
    $('#priceOut').textContent = 'до ' + money(v);
    refresh();
  });

  $('#inStock').addEventListener('change', (e) => { state.inStock = e.target.checked; refresh(); });
  $('#notOwned').addEventListener('change', (e) => { state.notOwned = e.target.checked; refresh(); });
  $('#resetFilters').addEventListener('click', resetFilters);

  $('#metalChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-metal]');
    if (!b) return;
    state.metal = b.dataset.metal;
    refresh();
  });

  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderResults(); });

  document.querySelector('.segmented').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    state.view = b.dataset.view;
    persist();
    renderResults();
  });

  $('#activeFilters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const [key, val] = b.dataset.remove.split(':');
    if (key === 'period') state.periods.delete(val);
    else if (key === 'grade') state.grades.delete(val);
    else if (key === 'query') { state.query = ''; $('#search').value = ''; }
    else if (key === 'metal') state.metal = 'all';
    else if (['yearFrom', 'yearTo', 'priceMax'].includes(key)) state[key] = null;
    else state[key] = false;
    renderFilters();
    refresh();
  });

  $('#favBtn').addEventListener('click', () => { state.onlyFav = !state.onlyFav; state.onlyOwned = false; refresh(); });
  $('#collectionBtn').addEventListener('click', () => { state.onlyOwned = !state.onlyOwned; state.onlyFav = false; refresh(); });

  $('#filtersToggle').addEventListener('click', (e) => {
    const open = $('#filters').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });

  $('#compareClear').addEventListener('click', () => { state.compare.clear(); renderResults(); renderCounters(); });
  $('#compareOpen').addEventListener('click', () => { if (state.compare.size >= 2) openCompare(); else toast('Оберіть щонайменше 2 предмети'); });

  $('#cartBtn').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  backdrop.addEventListener('click', closeCart);

  $('#cartContent').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cart]');
    if (!b) return;
    const { cart: act, id } = b.dataset;
    if (act === 'inc') { addToCart(id); return; }
    if (act === 'dec') { state.cart[id] > 1 ? state.cart[id]-- : delete state.cart[id]; }
    if (act === 'remove') delete state.cart[id];
    if (act === 'checkout') cartStep = 'checkout';
    if (act === 'back') cartStep = 'cart';
    if (act === 'close') { closeCart(); return; }
    persist();
    renderCart();
    refresh();
  });

  $('#cartContent').addEventListener('change', (e) => {
    if (e.target.name === 'delivery') $('#addressFields').hidden = e.target.value === 'pickup';
  });

  $('#cartContent').addEventListener('submit', (e) => {
    e.preventDefault();
    submitOrder(e.target);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cartOpen) closeCart();
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      $('#search').focus();
    }
  });

  $('#sort').value = state.sort;
  renderAll();
  if (location.hash === '#cart') { history.replaceState(null, '', location.pathname); openCart(); }
})();

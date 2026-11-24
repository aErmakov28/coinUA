(function () {
  'use strict';

  const Auth = window.Auth;
  const { items, metals } = window.CATALOG;
  const byId = new Map(items.map((it) => [it.id, it]));
  const root = document.getElementById('accountRoot');
  const fmt = new Intl.NumberFormat('uk-UA');
  const money = (n) => fmt.format(n) + ' ₴';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dateFmt = (iso) => new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

  const SECTIONS = [
    ['profile', 'Профіль'],
    ['orders', 'Замовлення'],
    ['favorites', 'Обране'],
    ['collection', 'Моя колекція'],
    ['security', 'Безпека']
  ];

  /* ---------- Дрібниці ---------- */
  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  function cart() { try { return JSON.parse(localStorage.getItem('coinua:cart')) || {}; } catch (e) { return {}; } }
  function renderCartCount() {
    document.getElementById('cartCount').textContent = Object.values(cart()).reduce((a, b) => a + b, 0);
  }

  function visual(it) {
    if (it.image) return `<img src="${esc(it.image)}" alt="" loading="lazy">`;
    if (it.cat === 'banknotes') return `<div class="note" style="--h:${Number(it.hue) || 40}"></div>`;
    if (it.cat === 'sets') return `<div class="set">${'<i></i>'.repeat(6)}</div>`;
    if (it.cat === 'accessories') return '<div class="album"></div>';
    return `<div class="coin ${it.metal === 'mixed' ? 'silver' : esc(it.metal)}"></div>`;
  }

  const current = () => {
    const h = location.hash.slice(1);
    return SECTIONS.some(([id]) => id === h) ? h : 'profile';
  };

  /* ---------- Гість ---------- */
  function renderGuest() {
    root.innerHTML = `
      <div class="acc-guest">
        <div class="acc-guest-card">
          <h1>Особистий кабінет</h1>
          <p>Увійдіть або створіть акаунт за <b>поштою</b> чи <b>номером мобільного</b> з паролем.</p>
          <div class="acc-guest-actions">
            <button type="button" class="btn btn-primary" data-open-auth="login">Увійти</button>
            <button type="button" class="btn btn-outline" data-open-auth="register">Зареєструватися</button>
          </div>
        </div>
        <ul class="acc-benefits">
          <li><b>Історія замовлень</b><span>Усі покупки та їхні статуси в одному місці.</span></li>
          <li><b>Обране й колекція</b><span>Відмічайте, що вже маєте, і що хочете придбати.</span></li>
          <li><b>Швидке оформлення</b><span>Ім’я, телефон і адреса доставки підставляються самі.</span></li>
        </ul>
      </div>`;
  }

  /* ---------- Розділи ---------- */
  function profileHtml(u) {
    const d = u.data || {};
    const loginLabel = u.email ? 'Пошта для входу' : 'Телефон для входу';
    const loginValue = u.email || Auth.formatPhone(u.phone);
    return `
      <h2>Профіль</h2>
      <form class="form acc-form" data-form="profile">
        <label class="field">${loginLabel}<input value="${esc(loginValue)}" readonly aria-readonly="true"></label>
        <label class="field">Ім’я та прізвище<input name="name" required autocomplete="name" value="${esc(u.name)}"></label>
        <label class="field">Контактний телефон<input name="contactPhone" type="tel" autocomplete="tel" placeholder="+380 XX XXX XX XX" value="${esc(d.contactPhone || (u.phone ? Auth.formatPhone(u.phone) : ''))}"></label>
        <fieldset class="acc-fieldset">
          <legend>Адреса доставки за замовчуванням</legend>
          <label class="field">Місто<input name="city" autocomplete="address-level2" value="${esc(d.city || '')}"></label>
          <label class="field">Відділення Нової Пошти або адреса<input name="branch" value="${esc(d.branch || '')}"></label>
        </fieldset>
        <div><button type="submit" class="btn btn-primary">Зберегти зміни</button></div>
      </form>`;
  }

  function ordersHtml(u) {
    const orders = (u.data && u.data.orders) || [];
    if (!orders.length) {
      return `<h2>Замовлення</h2>
        <div class="empty"><p>Замовлень поки немає.</p><a class="btn btn-primary" href="./">Перейти до каталогу</a></div>`;
    }
    return `<h2>Замовлення <span class="count">${orders.length}</span></h2>
      <div class="orders">${orders.map((o) => `
        <article class="order">
          <header class="order-head">
            <div><b class="mono">${esc(o.id)}</b><span class="small"> · ${dateFmt(o.date)}</span></div>
            <span class="status">${esc(o.status)}</span>
          </header>
          <ul class="order-items">${o.items.map((i) => `
            <li><span>${esc(i.name)} <span class="small mono">× ${i.qty}</span></span><span class="mono">${money(i.price * i.qty)}</span></li>`).join('')}
          </ul>
          <footer class="order-foot">
            <span class="small">${esc(o.delivery)}${o.address ? ' · ' + esc(o.address) : ''}<br>${esc(o.payment)}</span>
            <span class="order-total">Разом <b class="mono">${money(o.total)}</b></span>
          </footer>
          <div><button type="button" class="btn btn-outline" data-repeat="${esc(o.id)}">Повторити замовлення</button></div>
        </article>`).join('')}
      </div>`;
  }

  function listHtml(u, key, title, emptyText) {
    const ids = (u.data && u.data[key]) || [];
    const list = ids.map((id) => byId.get(id)).filter(Boolean);
    if (!list.length) {
      return `<h2>${title}</h2><div class="empty"><p>${emptyText}</p><a class="btn btn-primary" href="./">Перейти до каталогу</a></div>`;
    }
    return `<h2>${title} <span class="count">${list.length}</span></h2>
      <div class="grid">${list.map((it) => `
        <article class="card">
          <div class="card-media" style="cursor:default">${visual(it)}</div>
          <div class="card-meta"><span>${esc(it.code)}</span><span>${esc(it.grade)}</span></div>
          <h3>${esc(it.name)}</h3>
          <dl class="specs"><dt>Матеріал</dt><dd>${esc(metals[it.metal])}</dd><dt>Рік</dt><dd class="mono">${it.year}</dd></dl>
          <div class="card-foot"><span class="price">${money(it.price)}</span></div>
          <button type="button" class="btn btn-outline" data-remove-${key}="${it.id}">Прибрати</button>
        </article>`).join('')}
      </div>`;
  }

  function securityHtml() {
    const rec = Auth.recovery;
    const pw = (name, label, ac) => `
      <label class="field">${label}
        <span class="pw-wrap"><input name="${name}" type="password" required autocomplete="${ac}">
        <button type="button" class="pw-toggle" data-pw-toggle aria-label="Показати пароль" aria-pressed="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></span>
      </label>`;
    return `
      <h2>Безпека</h2>
      ${rec ? '<p class="auth-msg info">Встановіть новий пароль для свого акаунта.</p>' : ''}
      <form class="form acc-form" data-form="password">
        ${rec ? '' : pw('old', 'Поточний пароль', 'current-password')}
        ${pw('new1', 'Новий пароль', 'new-password')}
        <span class="hint" style="margin-top:-8px">Щонайменше 8 символів, літери й цифри</span>
        ${pw('new2', 'Повторіть новий пароль', 'new-password')}
        <div><button type="submit" class="btn btn-primary">${rec ? 'Встановити пароль' : 'Змінити пароль'}</button></div>
      </form>
      <div class="acc-signout">
        <div><b>Вийти з акаунта</b><p class="small" style="margin:4px 0 0">Обране й колекція залишаться в акаунті.</p></div>
        <button type="button" class="btn btn-outline" data-signout>Вийти</button>
      </div>`;
  }

  /* ---------- Кабінет ---------- */
  function render() {
    renderCartCount();
    const u = Auth.user;
    if (!u) { renderGuest(); return; }

    const sec = current();
    const d = u.data || {};
    const counts = { orders: (d.orders || []).length, favorites: (d.fav || []).length, collection: (d.owned || []).length };
    let panel = '';
    if (sec === 'profile') panel = profileHtml(u);
    if (sec === 'orders') panel = ordersHtml(u);
    if (sec === 'favorites') panel = listHtml(u, 'fav', 'Обране', 'Додавайте предмети в обране сердечком у каталозі.');
    if (sec === 'collection') panel = listHtml(u, 'owned', 'Моя колекція', 'Відмічайте «Є в моїй колекції» в картці предмета.');
    if (sec === 'security') panel = securityHtml();

    root.innerHTML = `
      <div class="acc-head">
        <div class="avatar" aria-hidden="true">${esc((u.name || '?').trim().charAt(0).toUpperCase())}</div>
        <div>
          <h1>${esc(u.name || 'Мій кабінет')}</h1>
          <p class="small" style="margin:0">${esc(u.email || Auth.formatPhone(u.phone))}${u.createdAt ? ' · з нами з ' + dateFmt(u.createdAt) : ''}${Auth.mode === 'demo' ? ' · демо-акаунт' : ''}</p>
        </div>
      </div>
      <div class="layout acc-layout">
        <nav class="acc-nav" aria-label="Розділи кабінету">
          ${SECTIONS.map(([id, label]) => `<a href="#${id}" ${id === sec ? 'aria-current="page"' : ''}>${label}${counts[id] ? `<span class="num">${counts[id]}</span>` : ''}</a>`).join('')}
        </nav>
        <section class="acc-panel">${panel}</section>
      </div>`;
  }

  /* ---------- Обробники ---------- */
  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      if (form.dataset.form === 'profile') {
        const f = form.elements;
        const name = f.name.value.trim();
        if (!name) throw new Error('Вкажіть ім’я');
        await Auth.updateProfile({
          name,
          contactPhone: f.contactPhone.value.trim(),
          city: f.city.value.trim(),
          branch: f.branch.value.trim()
        });
        toast('Профіль збережено');
        render();
      } else if (form.dataset.form === 'password') {
        if (form.new1.value !== form.new2.value) throw new Error('Нові паролі не збігаються');
        await Auth.changePassword(form.old ? form.old.value : '', form.new1.value);
        toast('Пароль змінено');
        render();
      }
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-pw-toggle]');
    if (t) {
      const input = t.previousElementSibling;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      t.setAttribute('aria-pressed', String(show));
      t.setAttribute('aria-label', show ? 'Сховати пароль' : 'Показати пароль');
      return;
    }
    if (e.target.closest('[data-signout]')) {
      await Auth.signOut();
      toast('Ви вийшли з акаунта');
      return;
    }
    const remove = e.target.closest('[data-remove-fav], [data-remove-owned]');
    if (remove) {
      const key = remove.hasAttribute('data-remove-fav') ? 'fav' : 'owned';
      const id = remove.getAttribute('data-remove-' + key);
      const list = ((Auth.user.data || {})[key] || []).filter((x) => x !== id);
      try { await Auth.updateData({ [key]: list }); render(); } catch (err) { toast(err.message); }
      return;
    }
    const repeat = e.target.closest('[data-repeat]');
    if (repeat) {
      const order = (Auth.user.data.orders || []).find((o) => o.id === repeat.dataset.repeat);
      const c = cart();
      let skipped = 0;
      order.items.forEach((i) => {
        const it = byId.get(i.id);
        if (!it || it.stock < 1) { skipped++; return; }
        c[i.id] = Math.min(it.stock, (c[i.id] || 0) + i.qty);
      });
      localStorage.setItem('coinua:cart', JSON.stringify(c));
      if (skipped) toast(skipped + ' поз. немає в наявності — їх не додано');
      setTimeout(() => { location.href = './#cart'; }, skipped ? 1200 : 0);
    }
  });

  window.addEventListener('hashchange', render);
  window.addEventListener('storage', renderCartCount);

  Auth.on((user, event) => {
    if (event === 'recovery' && location.hash !== '#security') location.hash = '#security';
    render();
  });
  Auth.ready.then(render);
})();

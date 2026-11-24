/*
 * Особистий кабінет CoinUA: реєстрація та вхід за поштою або телефоном з паролем.
 *
 * Два режими (див. js/config.js):
 *  - demo     — акаунти в localStorage цього браузера (пароль зберігається як хеш PBKDF2);
 *  - supabase — справжня авторизація Supabase Auth: підтвердження пошти листом,
 *               телефону — SMS-кодом, відновлення пароля, дані між пристроями.
 *
 * Публічний API: window.Auth
 *   Auth.ready            — Promise, що завершується після відновлення сесії
 *   Auth.user             — поточний користувач або null
 *   Auth.mode             — 'demo' | 'supabase'
 *   Auth.on(cb)           — підписка на зміну користувача; cb(user, event)
 *   Auth.openDialog(tab)  — відкрити вікно входу ('login' | 'register')
 *   Auth.updateProfile({ name, city, branch })
 *   Auth.updateData(patch) — зберегти дані користувача (обране, колекцію, замовлення)
 *   Auth.changePassword(oldPassword, newPassword)
 *   Auth.signOut()
 */
(function () {
  'use strict';

  const cfg = window.COINUA_CONFIG || {};
  const listeners = new Set();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Перевірка введених даних ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Приводить український номер до формату +380XXXXXXXXX або повертає null.
  function normalizePhone(raw) {
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('380')) return '+' + digits;
    if (digits.length === 10 && digits.startsWith('0')) return '+38' + digits;
    if (digits.length === 9) return '+380' + digits;
    return null;
  }

  // Визначає, що ввів користувач: пошту чи телефон.
  function parseLogin(raw) {
    const v = String(raw || '').trim();
    if (!v) return { error: 'Вкажіть пошту або номер телефону' };
    if (v.includes('@')) {
      return EMAIL_RE.test(v) ? { type: 'email', value: v.toLowerCase() } : { error: 'Перевірте адресу пошти' };
    }
    const phone = normalizePhone(v);
    return phone ? { type: 'phone', value: phone } : { error: 'Номер має бути у форматі +380 XX XXX XX XX' };
  }

  function checkPassword(pw) {
    if (!pw || pw.length < 8) return 'Пароль має містити щонайменше 8 символів';
    if (!/[A-Za-zА-Яа-яЇїІіЄєҐґ]/.test(pw) || !/\d/.test(pw)) return 'Пароль має містити літери й цифри';
    return null;
  }

  const formatPhone = (p) => p ? p.replace(/^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/, '+380 $1 $2 $3 $4') : '';

  /* ---------- Демо-адаптер (localStorage) ---------- */
  function demoAdapter() {
    const USERS = 'coinua:users';
    const SESSION = 'coinua:session';
    const read = () => { try { return JSON.parse(localStorage.getItem(USERS)) || {}; } catch (e) { return {}; } };
    const write = (u) => localStorage.setItem(USERS, JSON.stringify(u));
    const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

    async function hash(password, saltHex) {
      if (!window.crypto || !crypto.subtle) throw new Error('Браузер не підтримує безпечне зберігання пароля. Відкрийте сайт через https.');
      const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
      return { salt: toHex(salt), hash: toHex(bits) };
    }

    const find = (users, login) => Object.values(users).find((u) => u[login.type] === login.value);
    const publicUser = (u) => u && { id: u.id, email: u.email || null, phone: u.phone || null, name: u.name || '', createdAt: u.createdAt, data: u.data || {} };

    return {
      mode: 'demo',
      async restore() {
        const id = localStorage.getItem(SESSION);
        return id ? publicUser(read()[id]) : null;
      },
      async signUp(login, password, name) {
        const users = read();
        if (find(users, login)) throw new Error(login.type === 'email' ? 'Акаунт з цією поштою вже існує' : 'Акаунт з цим номером вже існує');
        const { salt, hash: h } = await hash(password);
        const id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        users[id] = { id, [login.type]: login.value, name, salt, hash: h, createdAt: new Date().toISOString(), data: {} };
        write(users);
        localStorage.setItem(SESSION, id);
        return { user: publicUser(users[id]) };
      },
      async signIn(login, password) {
        const users = read();
        const u = find(users, login);
        if (!u) throw new Error('Невірний логін або пароль');
        const { hash: h } = await hash(password, u.salt);
        if (h !== u.hash) throw new Error('Невірний логін або пароль');
        localStorage.setItem(SESSION, u.id);
        return { user: publicUser(u) };
      },
      async signOut() { localStorage.removeItem(SESSION); },
      async update(userId, patch) {
        const users = read();
        const u = users[userId];
        if (!u) throw new Error('Сесію завершено, увійдіть знову');
        if (patch.name !== undefined) u.name = patch.name;
        if (patch.data) u.data = { ...(u.data || {}), ...patch.data };
        write(users);
        return publicUser(u);
      },
      async changePassword(user, oldPw, newPw) {
        const users = read();
        const u = users[user.id];
        const check = await hash(oldPw, u.salt);
        if (check.hash !== u.hash) throw new Error('Поточний пароль невірний');
        Object.assign(u, await hash(newPw));
        write(users);
      },
      async resetPassword() {
        throw new Error('У демо-режимі відновлення пароля недоступне: акаунти зберігаються лише в цьому браузері.');
      },
      async verifyOtp() { throw new Error('У демо-режимі підтвердження не потрібне'); }
    };
  }

  /* ---------- Supabase-адаптер ---------- */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Не вдалося завантажити модуль авторизації'));
      document.head.appendChild(s);
    });
  }

  const SUPABASE_ERRORS = [
    [/invalid login credentials/i, 'Невірний логін або пароль'],
    [/already registered|already exists/i, 'Акаунт з такими даними вже існує'],
    [/email not confirmed/i, 'Пошту ще не підтверджено — перейдіть за посиланням з листа'],
    [/phone not confirmed/i, 'Номер ще не підтверджено — введіть код з SMS'],
    [/token has expired|invalid.*otp|otp.*invalid/i, 'Код невірний або застарів'],
    [/rate limit|too many/i, 'Забагато спроб. Спробуйте за кілька хвилин'],
    [/password should be/i, 'Пароль занадто простий'],
    [/sms|phone provider/i, 'Не вдалося надіслати SMS. Перевірте номер або спробуйте пізніше']
  ];
  const translate = (err) => {
    const msg = (err && err.message) || String(err);
    const hit = SUPABASE_ERRORS.find(([re]) => re.test(msg));
    return new Error(hit ? hit[1] : msg);
  };

  async function supabaseAdapter(emit) {
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const accountUrl = new URL('account.html', location.href).href;

    const map = (u) => {
      if (!u) return null;
      const meta = u.user_metadata || {};
      const { name, ...data } = meta;
      return { id: u.id, email: u.email || null, phone: u.phone ? '+' + u.phone.replace(/^\+/, '') : null, name: name || '', createdAt: u.created_at, data };
    };
    const run = async (p) => { const { data, error } = await p; if (error) throw translate(error); return data; };

    client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') emit(map(session && session.user), 'recovery');
      else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') emit(map(session && session.user), event);
    });

    return {
      mode: 'supabase',
      async restore() {
        const { data } = await client.auth.getSession();
        return map(data.session && data.session.user);
      },
      async signUp(login, password, name) {
        const creds = login.type === 'email'
          ? { email: login.value, password, options: { data: { name }, emailRedirectTo: accountUrl } }
          : { phone: login.value, password, options: { data: { name } } };
        const data = await run(client.auth.signUp(creds));
        if (!data.session) return { confirm: login.type };
        return { user: map(data.user) };
      },
      async signIn(login, password) {
        const data = await run(client.auth.signInWithPassword({ [login.type]: login.value, password }));
        return { user: map(data.user) };
      },
      async verifyOtp(phone, token, purpose) {
        const data = await run(client.auth.verifyOtp({ phone, token, type: 'sms' }));
        return { user: map(data.user), purpose };
      },
      async resetPassword(login) {
        if (login.type === 'email') {
          await run(client.auth.resetPasswordForEmail(login.value, { redirectTo: accountUrl + '#security' }));
          return { sent: 'email' };
        }
        await run(client.auth.signInWithOtp({ phone: login.value, options: { shouldCreateUser: false } }));
        return { sent: 'phone' };
      },
      async signOut() { await run(client.auth.signOut()); },
      async update(userId, patch) {
        const { data: current } = await client.auth.getUser();
        const meta = { ...((current.user && current.user.user_metadata) || {}) };
        if (patch.name !== undefined) meta.name = patch.name;
        if (patch.data) Object.assign(meta, patch.data);
        const data = await run(client.auth.updateUser({ data: meta }));
        return map(data.user);
      },
      async changePassword(user, oldPw, newPw, recovery) {
        if (!recovery) {
          const login = user.email ? { email: user.email } : { phone: user.phone };
          const { error } = await client.auth.signInWithPassword({ ...login, password: oldPw });
          if (error) throw new Error('Поточний пароль невірний');
        }
        await run(client.auth.updateUser({ password: newPw }));
      }
    };
  }

  /* ---------- Ядро ---------- */
  let adapter = null;

  const Auth = {
    user: null,
    mode: cfg.supabaseUrl && cfg.supabaseAnonKey ? 'supabase' : 'demo',
    recovery: sessionStorage.getItem('coinua:recovery') === '1',
    parseLogin, checkPassword, formatPhone, normalizePhone,
    on(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async updateProfile(patch) {
      requireUser();
      const { name, ...data } = patch;
      setUser(await adapter.update(Auth.user.id, { name, data }), 'profile');
    },
    async updateData(patch) {
      if (!Auth.user) return;
      setUser(await adapter.update(Auth.user.id, { data: patch }), 'data');
    },
    async changePassword(oldPw, newPw) {
      requireUser();
      const err = checkPassword(newPw);
      if (err) throw new Error(err);
      await adapter.changePassword(Auth.user, oldPw, newPw, Auth.recovery);
      Auth.recovery = false;
      sessionStorage.removeItem('coinua:recovery');
    },
    async signOut() {
      await adapter.signOut();
      setUser(null, 'signout');
    },
    openDialog(tab) { openDialog(tab || 'login'); }
  };

  function requireUser() { if (!Auth.user) throw new Error('Увійдіть в акаунт'); }

  function setUser(user, event) {
    Auth.user = user;
    if (event === 'recovery') { Auth.recovery = true; sessionStorage.setItem('coinua:recovery', '1'); }
    if (!user) { Auth.recovery = false; sessionStorage.removeItem('coinua:recovery'); }
    listeners.forEach((cb) => { try { cb(user, event); } catch (e) { console.error(e); } });
    renderSlots();
  }

  Auth.ready = (async () => {
    try {
      adapter = Auth.mode === 'supabase'
        ? await supabaseAdapter((u, ev) => { if (ev === 'recovery' || JSON.stringify(u) !== JSON.stringify(Auth.user)) setUser(u, ev); })
        : demoAdapter();
    } catch (e) {
      console.error(e);
      Auth.mode = 'demo';
      adapter = demoAdapter();
    }
    setUser(await adapter.restore(), 'restore');
  })();

  /* ---------- Кнопка в шапці ---------- */
  const userIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';

  function displayName(u) {
    if (!u) return '';
    return u.name || u.email || formatPhone(u.phone) || 'Кабінет';
  }

  function renderSlots() {
    document.querySelectorAll('[data-auth-slot]').forEach((slot) => {
      if (Auth.user) {
        const label = displayName(Auth.user).split(' ')[0];
        slot.innerHTML = `<a class="btn btn-outline account-btn" href="account.html" aria-label="Особистий кабінет">${userIcon}<span>${esc(label)}</span></a>`;
      } else {
        slot.innerHTML = `<button type="button" class="btn btn-outline account-btn" data-open-auth="login" aria-label="Увійти в акаунт">${userIcon}<span>Увійти</span></button>`;
      }
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open-auth]');
    if (b) { e.preventDefault(); openDialog(b.dataset.openAuth); }
  });

  /* ---------- Вікно входу / реєстрації ---------- */
  let dialog;
  let step = 'login';
  let pending = null; // { phone, purpose } для кроку SMS-коду

  const eye = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const pwField = (name, label, autocomplete) => `
    <label class="field">${label}
      <span class="pw-wrap">
        <input name="${name}" type="password" required autocomplete="${autocomplete}" minlength="8">
        <button type="button" class="pw-toggle" data-pw-toggle aria-label="Показати пароль" aria-pressed="false">${eye}</button>
      </span>
    </label>`;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'dialog dialog-auth';
    dialog.setAttribute('aria-labelledby', 'authTitle');
    document.body.appendChild(dialog);
    dialog.addEventListener('click', onDialogClick);
    dialog.addEventListener('submit', onSubmit);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    return dialog;
  }

  function openDialog(tab) {
    ensureDialog();
    step = tab;
    pending = null;
    renderDialog();
    if (!dialog.open) dialog.showModal();
    const first = dialog.querySelector('input');
    if (first) first.focus();
  }

  function renderDialog(message) {
    const demoNote = Auth.mode === 'demo'
      ? '<p class="auth-note">Демо-режим: акаунти зберігаються лише в цьому браузері. Для справжньої реєстрації підключіть Supabase (див. README).</p>'
      : '';
    const tabs = (step === 'login' || step === 'register') ? `
      <div class="auth-tabs" role="tablist">
        <button type="button" role="tab" data-step="login" aria-selected="${step === 'login'}">Вхід</button>
        <button type="button" role="tab" data-step="register" aria-selected="${step === 'register'}">Реєстрація</button>
      </div>` : '';
    const msg = message ? `<p class="auth-msg ${message.type}" role="${message.type === 'error' ? 'alert' : 'status'}">${esc(message.text)}</p>` : '';
    let body = '';

    if (step === 'login') {
      body = `
        <form class="form" data-form="login" novalidate>
          <label class="field">Пошта або телефон<input name="login" required autocomplete="username" placeholder="you@example.com або +380…"></label>
          ${pwField('password', 'Пароль', 'current-password')}
          <button type="submit" class="btn btn-primary btn-block">Увійти</button>
          <button type="button" class="link-btn accent" data-step="reset">Забули пароль?</button>
        </form>`;
    } else if (step === 'register') {
      body = `
        <form class="form" data-form="register" novalidate>
          <label class="field">Ім’я<input name="name" required autocomplete="name" placeholder="Ім’я Прізвище"></label>
          <label class="field">Пошта або телефон<input name="login" required autocomplete="username" placeholder="you@example.com або +380…">
            <span class="hint">Можна зареєструватися за поштою або за номером мобільного</span></label>
          ${pwField('password', 'Пароль', 'new-password')}
          <span class="hint" style="margin-top:-8px">Щонайменше 8 символів, літери й цифри</span>
          ${pwField('password2', 'Повторіть пароль', 'new-password')}
          <label class="check"><input type="checkbox" name="agree" required> Погоджуюся з умовами використання та обробкою персональних даних</label>
          <button type="submit" class="btn btn-primary btn-block">Створити акаунт</button>
        </form>`;
    } else if (step === 'otp') {
      body = `
        <form class="form" data-form="otp" novalidate>
          <p style="margin:0">Ми надіслали SMS з кодом на <b>${esc(formatPhone(pending.phone))}</b>.</p>
          <label class="field">Код з SMS<input name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" placeholder="000000" class="otp-input"></label>
          <button type="submit" class="btn btn-primary btn-block">Підтвердити</button>
          <button type="button" class="link-btn accent" data-step="login">Повернутися до входу</button>
        </form>`;
    } else if (step === 'reset') {
      body = `
        <form class="form" data-form="reset" novalidate>
          <p style="margin:0;color:var(--muted)">Вкажіть пошту — надішлемо посилання для нового пароля. Або номер телефону — надішлемо SMS-код.</p>
          <label class="field">Пошта або телефон<input name="login" required autocomplete="username"></label>
          <button type="submit" class="btn btn-primary btn-block">Відновити доступ</button>
          <button type="button" class="link-btn accent" data-step="login">Повернутися до входу</button>
        </form>`;
    } else if (step === 'email-sent') {
      body = `
        <div class="success">
          <div class="check-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></div>
          <p style="margin:0">${esc(pending && pending.text)}</p>
          <button type="button" class="btn btn-outline" data-step="login">Добре</button>
        </div>`;
    }

    const titles = { login: 'Вхід в акаунт', register: 'Реєстрація', otp: 'Підтвердження номера', reset: 'Відновлення пароля', 'email-sent': 'Перевірте пошту' };
    dialog.innerHTML = `
      <div class="dialog-body">
        <div class="dialog-head">
          <h2 id="authTitle">${titles[step]}</h2>
          <button type="button" class="icon-btn" data-auth-close aria-label="Закрити">✕</button>
        </div>
        ${tabs}${msg}${body}${demoNote}
      </div>`;
  }

  function onDialogClick(e) {
    if (e.target.closest('[data-auth-close]')) { dialog.close(); return; }
    const s = e.target.closest('[data-step]');
    if (s) { step = s.dataset.step; renderDialog(); const i = dialog.querySelector('input'); if (i) i.focus(); return; }
    const t = e.target.closest('[data-pw-toggle]');
    if (t) {
      const input = t.previousElementSibling;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      t.setAttribute('aria-pressed', String(show));
      t.setAttribute('aria-label', show ? 'Сховати пароль' : 'Показати пароль');
    }
  }

  const fail = (text) => { renderDialog({ type: 'error', text }); };

  function keepValues(form) {
    // Після перемальовки з помилкою повертаємо введене (крім паролів).
    const values = {};
    [...form.elements].forEach((el) => { if (el.name && el.type !== 'password' && el.type !== 'checkbox') values[el.name] = el.value; });
    return () => Object.entries(values).forEach(([k, v]) => { const el = dialog.querySelector(`[name="${k}"]`); if (el) el.value = v; });
  }

  async function onSubmit(e) {
    e.preventDefault();
    await Auth.ready;
    const form = e.target;
    const kind = form.dataset.form;
    const restore = keepValues(form);
    const submit = form.querySelector('[type="submit"]');
    const f = form.elements;

    const done = (user) => {
      dialog.close();
      if (user) setUser(user, 'signin');
    };

    try {
      if (kind === 'login') {
        const login = parseLogin(f.login.value);
        if (login.error) { fail(login.error); restore(); return; }
        if (!f.password.value) { fail('Введіть пароль'); restore(); return; }
        busy(submit, true);
        const res = await adapter.signIn(login, f.password.value);
        done(res.user);
      } else if (kind === 'register') {
        const name = f.name.value.trim();
        const login = parseLogin(f.login.value);
        if (!name) { fail('Вкажіть ім’я'); restore(); return; }
        if (login.error) { fail(login.error); restore(); return; }
        const pwErr = checkPassword(f.password.value);
        if (pwErr) { fail(pwErr); restore(); return; }
        if (f.password.value !== f.password2.value) { fail('Паролі не збігаються'); restore(); return; }
        if (!f.agree.checked) { fail('Потрібна згода з умовами'); restore(); return; }
        busy(submit, true);
        const res = await adapter.signUp(login, f.password.value, name);
        if (res.confirm === 'email') {
          pending = { text: `Ми надіслали лист на ${login.value}. Перейдіть за посиланням у ньому, щоб підтвердити пошту, а потім увійдіть.` };
          step = 'email-sent'; renderDialog();
        } else if (res.confirm === 'phone') {
          pending = { phone: login.value, purpose: 'signup' };
          step = 'otp'; renderDialog();
        } else done(res.user);
      } else if (kind === 'otp') {
        const code = f.code.value.trim();
        if (!/^\d{6}$/.test(code)) { fail('Код складається з 6 цифр'); return; }
        busy(submit, true);
        const res = await adapter.verifyOtp(pending.phone, code, pending.purpose);
        if (pending.purpose === 'reset') { Auth.recovery = true; sessionStorage.setItem('coinua:recovery', '1'); }
        done(res.user);
        if (pending.purpose === 'reset') location.href = 'account.html#security';
      } else if (kind === 'reset') {
        const login = parseLogin(f.login.value);
        if (login.error) { fail(login.error); restore(); return; }
        busy(submit, true);
        const res = await adapter.resetPassword(login);
        if (res.sent === 'email') {
          pending = { text: `Якщо акаунт з поштою ${login.value} існує, ми надіслали лист із посиланням для встановлення нового пароля.` };
          step = 'email-sent';
        } else {
          pending = { phone: login.value, purpose: 'reset' };
          step = 'otp';
        }
        renderDialog();
      }
    } catch (err) {
      fail(err.message || 'Щось пішло не так. Спробуйте ще раз');
      restore();
    }
  }

  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.textContent = on ? 'Зачекайте…' : btn.dataset.label;
  }

  document.addEventListener('DOMContentLoaded', renderSlots);
  if (document.readyState !== 'loading') renderSlots();

  window.Auth = Auth;
})();

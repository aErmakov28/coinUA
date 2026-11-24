/*
 * Налаштування CoinUA.
 *
 * Поки supabaseUrl і supabaseAnonKey порожні, особистий кабінет працює
 * в ДЕМО-режимі: акаунти зберігаються лише в цьому браузері (localStorage).
 *
 * Щоб увімкнути справжню реєстрацію (лист на пошту, SMS на телефон,
 * синхронізацію між пристроями), створіть проєкт на https://supabase.com
 * і вставте сюди Project URL та anon public key (Settings → API).
 * Anon key — публічний ключ, його можна зберігати у фронтенді.
 * Детальніше — у README.md, розділ «Особистий кабінет».
 */
window.COINUA_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};

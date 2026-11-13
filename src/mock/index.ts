// Только для разработки: фейковый Телеграм и сервер с тестовыми данными в памяти.
// В продакшен-сборку не попадает (подключается через import.meta.env.DEV в main.tsx).
//   http://localhost:5173/?mock            — админ
//   http://localhost:5173/?mock&role=staff — сотрудник
//   http://localhost:5173/?mock&role=point — точка Яндекс/Узум (только заказ)
import { setTransport } from '../lib/api';
import type { TelegramWebApp } from '../lib/telegram';
import { createDb } from './db';

export async function installMock() {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const noop = () => {};
  const tg: TelegramWebApp = {
    initData: 'mock',
    colorScheme: dark ? 'dark' : 'light',
    ready: noop, expand: noop, setHeaderColor: noop, setBackgroundColor: noop, onEvent: noop, disableVerticalSwipes: noop,
    showConfirm: (text, cb) => cb(window.confirm(text)),
    openLink: url => window.open(url, '_blank'),
    HapticFeedback: { notificationOccurred: noop, selectionChanged: noop, impactOccurred: noop },
  };
  window.Telegram = { WebApp: tg };

  const role = new URLSearchParams(location.search).get('role') || 'admin';
  const db = createDb(role);
  setTransport(async (action, payload) => {
    await new Promise(r => setTimeout(r, 150 + Math.random() * 200));
    try {
      const h = db[action];
      if (!h) return { error: 'Мок: нет обработчика «' + action + '»' };
      const res = h((payload || {}) as never);
      console.debug('[mock]', action, payload, '→', res);
      return JSON.parse(JSON.stringify(res ?? { ok: true }));
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
}

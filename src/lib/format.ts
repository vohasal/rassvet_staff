// Числа, даты, деньги — общие форматтеры приложения.

/** 1.5 → «1,5»; округление до сотых */
export const fmt = (x: unknown) => String(Math.round(Number(x) * 100) / 100).replace('.', ',');

/** «14 ноября, 21:40» */
export const fmtTs = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

/** Нормализация для нечёткого сравнения названий */
export const norm2 = (s: unknown) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** «1,6» → 1.6; пустая строка остаётся '' (поле не заполнено); мусор → NaN */
export const toNum = (v: unknown): number | '' => {
  const s = String(v ?? '').replace(/\s/g, '').replace(',', '.');
  return s === '' ? '' : Number(s);
};

/** Красивое количество для техкарт: ≥20 — целые, ≥1 — десятые, иначе сотые */
export const q = (x: unknown) => {
  const n = Number(x);
  if (!isFinite(n)) return '—';
  return fmt(n >= 20 ? Math.round(n) : n >= 1 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100);
};

/** Текущая дата в Ташкенте (UTC+5), YYYY-MM-DD */
export const tashDay = () => new Date(Date.now() + 5 * 36e5).toISOString().slice(0, 10);

export const addD = (date: string, n: number) => {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const diffD = (a: string, b: string) => Math.round((+new Date(a + 'T12:00:00Z') - +new Date(b + 'T12:00:00Z')) / 864e5);

/** Минуты от полуночи → «9:05» */
export const hmS = (m: number) => Math.floor(m / 60) % 24 + ':' + String(m % 60).padStart(2, '0');

/** YYYY-MM-DD → «14.11» */
export const dmy = (d: string) => d.slice(8, 10) + '.' + d.slice(5, 7);

/** Дата в UTC-полдень, чтобы не съезжал день: «пн, 14 нояб.» и т.п. */
export const dayUTC = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00Z').toLocaleDateString('ru-RU', { ...opts, timeZone: 'UTC' });

/** Время в Ташкенте */
export const tmTash = (ts: number) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
export const hhmm = (ts: number) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** Склонение: plural(5, 'день', 'дня', 'дней') */
export const plural = (n: number, one: string, few: string, many: string) => {
  const m = n % 10, h = n % 100;
  return h > 10 && h < 20 ? many : m === 1 ? one : m > 1 && m < 5 ? few : many;
};

// ===== Деньги =====
/** «200 000», «200000 сум», «200к», «1,5 млн» → число; не понял → NaN */
export const parseMoney = (v: unknown) => {
  const s = String(v ?? '').toLowerCase().replace(/сум|sum|\s/g, '').replace(',', '.');
  const m = s.match(/^(\d+(?:\.\d+)?)(к|k|т|тыс|млн|m)?$/);
  if (!m) return NaN;
  return Math.round(Number(m[1]) * (!m[2] ? 1 : /млн|m/.test(m[2]) ? 1e6 : 1e3));
};
/** 1234567 → «1 234 567 сум» */
export const money = (x: unknown) => {
  const n = Math.round(Number(x) || 0);
  return (n < 0 ? '−' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' сум';
};

/** Первая буква имени — для кружков-аватарок */
export const firstLetter = (s: unknown, dflt = '?') => String(s || dflt)[0] || dflt;

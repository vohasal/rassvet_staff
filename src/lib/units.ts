import { fmt } from './format';
import { toast } from '../store/ui';

// Перевод единиц: л↔мл, кг↔г. ['v', 1000] — объём, множитель к мл
export const UNIT = (u0: unknown): [string, number] => {
  const u = String(u0 || '').toLowerCase().replace('.', '').trim();
  if (/^(мл|ml)$/.test(u)) return ['v', 1];
  if (/^(л|l|лит)/.test(u)) return ['v', 1000];
  if (/^(г|гр|g)$/.test(u)) return ['m', 1];
  if (/^(кг|kg)$/.test(u)) return ['m', 1000];
  return [u, 1];
};
export const conv = (x: number, from: unknown, to: unknown) => {
  const a = UNIT(from), b = UNIT(to);
  return a[0] === b[0] ? (x * a[1]) / b[1] : null;
};

// Вписали граммы/мл вместо кг/л (1600 вместо 1,6): в кг/л больше 50 не бывает — меняем сами, без вопроса
const UNIT_BIG = /^(л|l|литр\S*|кг|kg|килограмм\S*)$/i, BIG_MAX = 50;
export const bigTo = (v: number, unit: unknown) => {
  const u = String(unit || '').trim().replace(/\.$/, '');
  return UNIT_BIG.test(u) && v > BIG_MAX ? Math.round(v / 10) / 100 : null;
};

/** Поправить одно значение поля при выходе из него. Возвращает новый текст или null */
export function autoBigText(text: string, unit: unknown, quiet = false): string | null {
  const s = String(text).replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const v = Number(s);
  if (isNaN(v)) return null;
  const g = bigTo(v, unit);
  if (g == null) return null;
  if (!quiet) toast(fmt(v) + ' → ' + fmt(g) + ' ' + String(unit || '').trim());
  return fmt(g);
}

export interface BigItem { v: number; unit?: string; set?: (text: string) => void }
/** Страховка на кнопке: поправить список значений (it.v меняется на месте) */
export function fixBig(list: BigItem[]) {
  const done: string[] = [];
  for (const it of list) {
    const g = bigTo(it.v, it.unit);
    if (g == null) continue;
    done.push(fmt(it.v) + ' → ' + fmt(g) + ' ' + String(it.unit || '').trim());
    it.v = g;
    it.set?.(fmt(g));
  }
  if (done.length) toast('Поправил: ' + done.join(', '));
}

/** Подсказка в поле «Почти пусто»: 0,15 л/кг, 150 мл/г, штуки — 0 */
export function lowDef(unit: unknown) {
  const u = String(unit || '').trim().replace(/\.$/, '');
  return /^(л|l|литр\S*|кг|kg|килограмм\S*)$/i.test(u) ? '0,15' : /^(мл|ml|г|гр|g|грамм\S*)$/i.test(u) ? '150' : '0';
}

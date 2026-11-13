import { create } from 'zustand';
import logo from '../../assets/logo.jpg';
import type { CashPreview, CountResult, Me, Prep } from '../../api/types';
import { photoKey, type Photo } from '../../components/photos';
import { fmt, toNum } from '../../lib/format';

/** Строка остатка: сколько + дата с наклейки */
export interface Row { q: string; d: string }

/**
 * Черновик закрытия. Ключи:
 *  'r:<pid>' — строки остатков по датам; 'f:<pid>' — морозилка;
 *  '$ik' / '$cf' / '$env' — касса по iiko, касса по факту, конверт
 */
export type Draft = Record<string, Row[] | string>;

/** Разбор недостачи перед закрытием */
export interface CashChk { first: { kd: number; ed: number }; s1: boolean; s2: boolean; note: string; res: CashPreview | null }

interface CountState {
  draft: Draft;
  checks: number[];
  photos: Photo[];
  cashChk: CashChk | null;
  countReopen: boolean;            // «Изменить подсчёт» у уже закрытой смены
  lastResult: CountResult | null;  // ответ сервера сразу после закрытия
  sentCopy: { draft: Draft; checks: number[]; photos: Photo[] } | null;   // что отправили — вернуть по «Изменить подсчёт»
}

export const useCountStore = create<CountState>(() => ({
  draft: {}, checks: [], photos: [], cashChk: null, countReopen: false, lastResult: null, sentCopy: null,
}));

export const setDraft = (k: string, v: Row[] | string) => useCountStore.setState(s => ({ draft: { ...s.draft, [k]: v } }));

// ---- черновик переживает закрытие приложения (10 часов) ----
const DRAFT_KEY = 'rassvet_close_draft';
let timer: number | undefined;
function saveDraft() {
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    const { draft, checks, photos } = useCountStore.getState();
    const data = { ts: Date.now(), checks, draft, photos: photos.filter(p => p.id).map(p => ({ id: p.id, src: p.src })) };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); }
    catch {
      // не влезло — сохраняем без превью фото
      try { data.photos = data.photos.map(p => ({ id: p.id, src: '' })); localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* нет места */ }
    }
  }, 300);
}
useCountStore.subscribe((s, prev) => {
  if (s.draft !== prev.draft || s.checks !== prev.checks || s.photos !== prev.photos) saveDraft();
});

export function loadDraft(): boolean {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!d || Date.now() - d.ts > 10 * 3600e3) return false;
    const photos: Photo[] = (d.photos || []).map((p: { id: string; src: string }) => ({ key: photoKey(), id: p.id, src: p.src || logo }));
    useCountStore.setState({ checks: d.checks || [], draft: d.draft || {}, photos });
    return !!((d.checks || []).length || Object.keys(d.draft || {}).length || photos.length);
  } catch { return false; }
}
export function clearDraft() { clearTimeout(timer); try { localStorage.removeItem(DRAFT_KEY); } catch { /* нет доступа */ } }

// ---- остатки ----
/** Строки заготовки: черновик, иначе даты партий в холодильнике, иначе одна пустая строка */
export function closeRows(p: Prep, draft: Draft, me: Me): Row[] {
  const dr = draft['r:' + p.id];
  if (Array.isArray(dr) && dr.length) return dr;
  const out: Row[] = [], seen: Record<string, 1> = {};
  ((me.cb || {})[p.id] || []).forEach(x => { if (x.day && !seen[x.day]) { seen[x.day] = 1; out.push({ q: '', d: x.day }); } });
  return out.length ? out : [{ q: '', d: '' }];
}

/** Сумма по строкам. Пустые строки не считаем; сумма — только когда у всех остальных есть число */
export function closeSum(rows: Row[]): string {
  const rs = rows.filter(r => String(r.q).trim() !== '' || r.d);
  if (!rs.length) return '';
  let t = 0;
  for (const r of rs) { const v = toNum(r.q); if (v === '' || isNaN(v) || v < 0) return ''; t += v; }
  return fmt(t);
}

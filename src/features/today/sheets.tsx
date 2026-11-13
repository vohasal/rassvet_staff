// Шторки вкладки «Сегодня»: замена смены, проблема, посуда, варка задним числом
import { useEffect, useRef, useState } from 'react';
import { invalidate, qk, refreshMe } from '../../api/queries';
import type { LabelItem, Me } from '../../api/types';
import { askLabel } from '../../components/ask';
import { NumInput } from '../../components/inputs';
import { Sheet } from '../../components/overlays';
import { PhotoGrid, uploadPhotos, type Photo } from '../../components/photos';
import { call, errMsg } from '../../lib/api';
import { tashDay, toNum } from '../../lib/format';
import { haptic } from '../../lib/telegram';
import { fixBig } from '../../lib/units';
import { closeSheet, openSheet, toast } from '../../store/ui';

/** Отдать смену или поменяться сменами: 'give' | 'swap' | null */
export function chooseSwapMode(dayLabel: string): Promise<'give' | 'swap' | null> {
  return new Promise(res => {
    const done = (v: 'give' | 'swap' | null) => { closeSheet(); res(v); };
    openSheet(
      <Sheet onClose={() => done(null)}>
        <h2>Замена на {dayLabel}</h2>
        <p className="sub" style={{ marginTop: 4 }}>В группу уйдёт заявка, админ подтвердит, график поправится сам</p>
        <button className="btn" onClick={() => done('give')}>🙋 Отдать смену</button>
        <p className="sub" style={{ margin: '6px 2px 0' }}>Кто возьмёт — выйдет вместо тебя, у тебя выходной</p>
        <button className="btn ok" onClick={() => done('swap')}>🔄 Поменяться сменами</button>
        <p className="sub" style={{ margin: '6px 2px 0' }}>Тот, кто работает в этот день, выйдет на твоё время, а ты — на его</p>
        <button className="btn soft" onClick={() => done(null)}>Отмена</button>
      </Sheet>,
    );
  });
}

/** Заказ посуды: уходит задачей управляющим, бот напоминает раз в 3 дня, пока не закажут */
export function DishSheet() {
  const [f, setF] = useState({ what: '', qty: '', note: '' });
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const what = f.what.trim(), qty = f.qty.trim(), note = f.note.trim();
    if (!what) return toast('Напиши, какая посуда нужна');
    if (!qty) return toast('Укажи, сколько нужно');
    setBusy(true);
    try { await call('dishOrder', { what, qty, note }); haptic('success'); toast('Заказ отправлен, спасибо! 🍽'); closeSheet(); }
    catch (e) { toast(errMsg(e)); setBusy(false); }
  };
  return (
    <Sheet>
      <h2>🍽 Заказать посуду</h2>
      <p className="sub" style={{ marginTop: 4 }}>Чего не хватает или что разбилось. Управляющие получат задачу и закажут</p>
      <div className="form">
        <label>Какая посуда</label><input maxLength={200} placeholder="Например: бокалы для лимонада 400 мл" value={f.what} onChange={e => setF({ ...f, what: e.target.value })} />
        <label>Сколько</label><input maxLength={40} placeholder="Например: 6 шт" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} />
        <label>Комментарий (необязательно)</label><textarea rows={2} maxLength={300} placeholder="Например: разбили 2, осталось 4" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
      </div>
      <button className="btn" disabled={busy} onClick={send}>{busy ? 'Отправляю…' : 'Отправить заказ'}</button>
      <button className="btn soft" onClick={closeSheet}>Отмена</button>
    </Sheet>
  );
}

/** Сообщить о проблеме: текст + до 3 фото */
export function ProblemSheet({ done }: { done?: () => void }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const t = text.trim();
    if (!t) return toast('Опиши проблему');
    if (photos.some(p => p.loading)) return toast('Подожди, фото загружаются…');
    setBusy(true);
    try { await call('probAdd', { text: t, photos: photos.filter(p => p.id).map(p => p.id) }); haptic('success'); toast('Отправлено, спасибо! 🙏'); closeSheet(); done?.(); }
    catch (e) { toast(errMsg(e)); setBusy(false); }
  };
  return (
    <Sheet>
      <h2>⚠️ Сообщить о проблеме</h2>
      <p className="sub" style={{ marginTop: 4 }}>Что сломалось, закончилось или мешает работе. Админ получит сразу</p>
      <div className="form"><textarea rows={3} placeholder="Например: кофемолка №2 мелет неравномерно" value={text} onChange={e => setText(e.target.value)} /></div>
      <PhotoGrid photos={photos} max={3} onRemove={i => setPhotos(l => l.filter((_, k) => k !== i))} onAdd={files => uploadPhotos(files, 'probPhoto', setPhotos)} />
      <button className="btn" disabled={busy} onClick={send}>{busy ? 'Отправляю…' : 'Отправить'}</button>
      <button className="btn soft" onClick={closeSheet}>Отмена</button>
    </Sheet>
  );
}

/** Забыли отметить варку: заготовка, день (до 3 дней назад), выход. Срок — от дня варки */
export function LateSheet({ me }: { me: Me }) {
  const n = me.lateDays || 3, today = me.today?.date || tashDay();
  const days: string[] = [];
  for (let i = 1; i <= n; i++) days.push(new Date(new Date(today + 'T12:00:00Z').getTime() - i * 864e5).toISOString().slice(0, 10));
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const lbl = (d: string, i: number) => (i === 0 ? 'Вчера' : i === 1 ? 'Позавчера' : WD[new Date(d + 'T12:00:00Z').getUTCDay()]) + ', ' + d.slice(8, 10) + '.' + d.slice(5, 7);

  const [pid, setPid] = useState('');
  const [day, setDay] = useState(days[0]);
  const [qv, setQ] = useState('');
  const [fv, setF] = useState('');
  const [busy, setBusy] = useState(false);
  const qRef = useRef<HTMLInputElement>(null);
  const p = me.preps.find(x => x.id === pid);
  useEffect(() => { if (p) { const t = setTimeout(() => qRef.current?.focus(), 60); return () => clearTimeout(t); } }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  const ok = async () => {
    if (!p) { toast('Выбери заготовку'); return; }
    const qn = toNum(qv);
    if (qn === '' || !(qn > 0)) { toast('Впиши итоговый выход'); qRef.current?.focus(); return; }
    const it = { v: qn, unit: p.unit, set: setQ };
    const fn = p.frz ? toNum(fv) : '';
    const ft = { v: fn === '' ? 0 : fn, unit: p.unit, set: fn === '' ? undefined : setF };
    fixBig([it, ft]);
    if (isNaN(ft.v) || ft.v < 0 || ft.v > it.v) { toast('В морозилку — не больше, чем сварено'); return; }
    setBusy(true);
    try {
      const r = await call<{ label?: LabelItem[] }>('madeLate', { pid: p.id, day, q: it.v, f: ft.v });
      closeSheet(); invalidate(qk.fridge); haptic('success');
      toast('Внесено за ' + day.slice(8, 10) + '.' + day.slice(5, 7) + ' ✅');
      await refreshMe();
      askLabel(r?.label);
    } catch (e) { toast(errMsg(e)); setBusy(false); }
  };

  return (
    <Sheet>
      <h2>📅 Варка задним числом</h2>
      <p className="sub" style={{ marginTop: 4 }}>Забыл(а) отметить, что сварил(а)? Выбери заготовку, день и сколько вышло. Срок годности посчитается от этого дня. Можно до {n} дней назад</p>
      <label className="sub" style={{ display: 'block', marginTop: 10 }}>Что сварил(а)
        <select style={{ marginTop: 6 }} value={pid} onChange={e => setPid(e.target.value)}>
          <option value="">— выбери заготовку —</option>
          {me.preps.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <p className="sub" style={{ margin: '12px 0 0' }}>Когда сварил(а)</p>
      <div className="seg">{days.map((d, i) => <button key={d} className={d === day ? 'on st0' : ''} onClick={() => setDay(d)}>{lbl(d, i)}</button>)}</div>
      <div className="amount"><span>Итоговый выход</span><NumInput ref={qRef} unit={p?.unit} value={qv} onChange={setQ} placeholder="0" /><b>{p ? p.unit || '' : ''}</b></div>
      {p?.frz && <div className="amount"><span>❄️ Из них в морозилку</span><NumInput unit={p.unit} value={fv} onChange={setF} placeholder="0" /><b>{p.unit || ''}</b></div>}
      <button className="btn" disabled={busy} onClick={ok}>{busy ? 'Вношу…' : '✅ Внести'}</button>
      <button className="btn soft" onClick={closeSheet}>Отмена</button>
    </Sheet>
  );
}

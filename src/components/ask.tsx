// Окошки-вопросы снизу экрана. Каждое возвращает Promise с ответом (null — закрыли).
import { useEffect, useRef, useState } from 'react';
import { Sheet } from './overlays';
import { NumInput } from './inputs';
import { closeSheet, openSheet, toast } from '../store/ui';
import { call, errMsg } from '../lib/api';
import { fmt, toNum } from '../lib/format';
import { fixBig } from '../lib/units';
import { haptic } from '../lib/telegram';
import { invalidate, qk } from '../api/queries';
import type { LabelItem } from '../api/types';

/** «Сколько?» — число > 0 или null */
export function askQty(title: string, sub: string, def: number | '' | null | undefined, unit: string | undefined, okText = 'Готово'): Promise<number | null> {
  return new Promise(res => {
    const done = (v: number | null) => { closeSheet(); res(v); };
    openSheet(<AskQty title={title} sub={sub} def={def} unit={unit} okText={okText} done={done} />);
  });
}
function AskQty({ title, sub, def, unit, okText, done }: { title: string; sub: string; def: number | '' | null | undefined; unit?: string; okText: string; done: (v: number | null) => void }) {
  const [v, setV] = useState(def != null && def !== '' ? fmt(def) : '');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 60); return () => clearTimeout(t); }, []);
  const ok = () => {
    const n = toNum(v);
    if (n === '' || !(n > 0)) { toast('Впиши количество'); ref.current?.focus(); return; }
    const it = { v: n, unit, set: setV };
    fixBig([it]);
    done(it.v);
  };
  return (
    <Sheet onClose={() => done(null)}>
      <h2>{title}</h2>{sub ? <p className="sub" style={{ marginTop: 4 }}>{sub}</p> : null}
      <div className="amount"><span>Количество</span><NumInput ref={ref} value={v} onChange={setV} placeholder="0" /><b>{unit || ''}</b></div>
      <button className="btn" onClick={ok}>{okText}</button>
      <button className="btn soft" onClick={() => done(null)}>Отмена</button>
    </Sheet>
  );
}

/** «Дата на наклейке» — YYYY-MM-DD не позже max, или null */
export function askDate(title: string, sub: string, max: string, okText = 'Готово'): Promise<string | null> {
  return new Promise(res => {
    const done = (v: string | null) => { closeSheet(); res(v); };
    openSheet(<AskDate title={title} sub={sub} max={max} okText={okText} done={done} />);
  });
}
function AskDate({ title, sub, max, okText, done }: { title: string; sub: string; max: string; okText: string; done: (v: string | null) => void }) {
  const [v, setV] = useState('');
  const ok = () => {
    if (!v) { toast('Выбери дату с наклейки'); return; }
    if (v > max) { toast('Дата не может быть из будущего'); return; }
    done(v);
  };
  return (
    <Sheet onClose={() => done(null)}>
      <h2>{title}</h2>{sub ? <p className="sub" style={{ marginTop: 4 }}>{sub}</p> : null}
      <div className="form"><label>Дата на наклейке<input type="date" max={max} value={v} onChange={e => setV(e.target.value)} /></label></div>
      <button className="btn" onClick={ok}>{okText}</button>
      <button className="btn soft" onClick={() => done(null)}>Отмена</button>
    </Sheet>
  );
}

/** Только что сварили / разморозили / убрали в морозилку: что написать на наклейке */
export function askLabel(list: LabelItem[] | undefined): Promise<void> {
  if (!list || !list.length) return Promise.resolve();
  return new Promise(res => {
    const done = () => { closeSheet(); res(); };
    openSheet(<AskLabel list={list} done={done} />);
  });
}
function AskLabel({ list, done }: { list: LabelItem[]; done: () => void }) {
  const dd = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  const ok = async () => {
    try {
      await call('batchMark', { ids: list.map(x => x.id) });
      haptic('success'); toast('Промаркировано 🏷');
    } catch (e) { toast(errMsg(e)); }
    invalidate(qk.fridge);
    done();
  };
  return (
    <Sheet onClose={done}>
      <h2>🏷 Промаркируй заготовку</h2>
      <p className="sub" style={{ marginTop: 4 }}>Напиши на наклейке и приклей на тару:</p>
      {list.map(x => (
        <div className="batch" key={x.id}>
          <div className="pname">
            <b>{x.name}{x.state === 'f' ? ' ❄️' : ''}</b>
            <span>{x.state === 'f' ? 'В морозилку' : 'Сварено'}: {dd(x.made)}{x.exp ? ' · годна до ' + dd(x.exp) : ''}</span>
          </div>
        </div>
      ))}
      <button className="btn" onClick={ok}>✅ Промаркировал(а)</button>
      <button className="btn soft" onClick={() => { toast('Через 30 минут бот напомнит 🏷'); done(); }}>Позже</button>
    </Sheet>
  );
}

// Точки Яндекс/Узум: заказ заготовок на завтра и «Забрал заказ»
import { useState } from 'react';
import { create } from 'zustand';
import { patchMe, refreshMe, useMe } from '../../api/queries';
import type { Me, Pickup } from '../../api/types';
import { NumInput } from '../../components/inputs';
import { Sheet } from '../../components/overlays';
import { Card, Dock, Empty } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { fmt, hhmm, toNum } from '../../lib/format';
import { confirmBox, haptic } from '../../lib/telegram';
import { fixBig, type BigItem } from '../../lib/units';
import { closeSheet, openSheet, toast } from '../../store/ui';
import { GuCard } from '../today/cards';

// что вписали, но ещё не отправили — живёт между вкладками
const useOrderDraft = create<{ d: Record<string, string> }>(() => ({ d: {} }));

/** Числа из полей: { pid: число > 0 }; bad — сколько полей с ошибкой */
function readItems(me: Me, vals: Record<string, string>) {
  const items: Record<string, number> = {};
  let bad = 0;
  me.preps.forEach(p => { const v = toNum(vals[p.id] ?? ''); if (v === '') return; if (isNaN(v) || v < 0) bad++; else if (v > 0) items[p.id] = v; });
  return { items, bad };
}
function fixItems(me: Me, items: Record<string, number>, set: (pid: string, t: string) => void) {
  const chk: (BigItem & { pid: string })[] = Object.keys(items).map(pid => ({ pid, v: items[pid], unit: me.preps.find(x => x.id === pid)?.unit, set: t => set(pid, t) }));
  fixBig(chk);
  chk.forEach(c => { items[c.pid] = c.v; });
}

export function OrderView() {
  const me = useMe();
  const draft = useOrderDraft(s => s.d);
  const [busy, setBusy] = useState(false);
  const o = me.order || { date: '', items: {} };
  if (!me.preps.length) return <Empty icon="🫙" title="Заготовок пока нет" text="Администратор ещё не добавил список." />;
  const when = o.date ? new Date(o.date + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const has = Object.keys(o.items).length;
  const val = (pid: string) => draft[pid] ?? (o.items[pid] != null ? String(o.items[pid]) : '');
  const set = (pid: string, t: string) => useOrderDraft.setState(s => ({ d: { ...s.d, [pid]: t } }));

  const send = async () => {
    const vals: Record<string, string> = {};
    me.preps.forEach(p => { vals[p.id] = val(p.id); });
    const { items, bad } = readItems(me, vals);
    if (bad) { toast('Проверь числа — есть ошибка'); haptic('error'); return; }
    fixItems(me, items, set);
    if (!Object.keys(items).length && !(await confirmBox('Заказ пустой. Отменить заказ на завтра?'))) return;
    setBusy(true);
    try {
      await call('order', { items });
      useOrderDraft.setState({ d: {} });
      await refreshMe();
      haptic('success'); toast(Object.keys(items).length ? 'Заказ сохранён ✅' : 'Заказ отменён');
    } catch (e) { toast(errMsg(e)); }
    setBusy(false);
  };

  return (
    <>
      <GuCard me={me} />
      <PickupCard me={me} />
      <Card>
        <h2>Заказ заготовок</h2>
        <p className="sub">Впиши, сколько нужно. Заказ уйдёт в группу бара <b>{when} в 08:00</b>.{has ? ' Заказ уже сохранён — можно изменить до отправки.' : ''}</p>
        {me.preps.map(p => (
          <div className="prow" key={p.id}>
            <div className="pname"><b>{p.name}</b></div>
            <label className="field"><NumInput enterKeyHint="next" data-oid={p.id} unit={p.unit} value={val(p.id)} placeholder="0" onChange={t => set(p.id, t)} /><small>{p.unit}</small></label>
          </div>
        ))}
      </Card>
      <Dock><button className="btn" disabled={busy} onClick={send}>{busy ? 'Отправляю…' : has ? 'Обновить заказ' : 'Отправить заказ'}</button></Dock>
    </>
  );
}

// ===== ТОЧКА ЗАБРАЛА ЗАКАЗ =====
function PickupCard({ me }: { me: Me }) {
  const k = me.pickup; if (!k) return null;
  const byId = Object.fromEntries(me.preps.map(p => [p.id, p]));
  const list = (items: Record<string, number>) => Object.keys(items).map(pid => (byId[pid]?.name || pid) + ' ' + fmt(items[pid]) + ' ' + (byId[pid]?.unit || '')).join(', ');
  if (k.picked) return <Card><h2>📦 Заказ на сегодня забран</h2><p className="sub">{hhmm(k.picked.at)}: {list(k.picked.items)}</p></Card>;
  const has = Object.keys(k.items).length;
  return (
    <Card>
      <h2>📦 Забрать заказ</h2>
      <p className="sub">{has ? 'Сегодняшний заказ: ' + list(k.items) + '. ' : ''}Взял(а) заготовки — нажми и впиши, сколько забрал(а) на самом деле.</p>
      <button className="btn" onClick={() => openSheet(<PickupSheet me={me} k={k} />)}>📦 Забрал заказ</button>
    </Card>
  );
}

function PickupSheet({ me, k }: { me: Me; k: Pickup }) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(me.preps.map(p => [p.id, k.items[p.id] != null ? String(k.items[p.id]).replace('.', ',') : ''])));
  const [busy, setBusy] = useState(false);
  const set = (pid: string, t: string) => setVals(v => ({ ...v, [pid]: t }));
  const send = async () => {
    const { items, bad } = readItems(me, vals);
    if (bad) return toast('Проверь числа');
    if (!Object.keys(items).length) return toast('Впиши, сколько забрал(а)');
    fixItems(me, items, set);
    setBusy(true);
    try {
      const r = await call<{ pickup: Pickup }>('orderPickup', { items });
      patchMe({ pickup: r.pickup }); haptic('success'); toast('Отмечено, спасибо! 📦'); closeSheet();
    } catch (e) { toast(errMsg(e)); setBusy(false); }
  };
  return (
    <Sheet>
      <h2>📦 Забрал заказ</h2>
      <p className="sub" style={{ marginTop: 4 }}>Проверь цифры: если чего-то не хватило или взял(а) больше — поправь. Это вычтется из холодильника бара</p>
      {me.preps.map(p => (
        <div className="prow" key={p.id}>
          <div className="pname"><b>{p.name}</b>{k.items[p.id] != null ? <span>в заказе {fmt(k.items[p.id])} {p.unit}</span> : null}</div>
          <label className="field"><NumInput unit={p.unit} value={vals[p.id]} placeholder="0" onChange={t => set(p.id, t)} /><small>{p.unit}</small></label>
        </div>
      ))}
      <button className="btn" disabled={busy} onClick={send}>Подтвердить</button>
      <button className="btn soft" onClick={closeSheet}>Отмена</button>
    </Sheet>
  );
}

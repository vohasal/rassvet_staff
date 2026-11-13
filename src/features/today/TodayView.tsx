import { useState } from 'react';
import { invalidate, qk, refreshMe, useMe } from '../../api/queries';
import type { LabelItem, Me, NeedItem } from '../../api/types';
import { askLabel, askQty } from '../../components/ask';
import { NumInput } from '../../components/inputs';
import { Dock, Empty } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { fmt, toNum } from '../../lib/format';
import { confirmBox, haptic, hapticSelect } from '../../lib/telegram';
import { fixBig, type BigItem } from '../../lib/units';
import { openSheet, toast } from '../../store/ui';
import { openTkForPrep } from '../tk/TkSheet';
import { HomeExtra } from './HomeExtra';
import { ShiftCard } from './ShiftCard';
import { LateSheet } from './sheets';
import { useTodayStore } from './store';

type Row = { pid: string; name: string; unit: string };

export function TodayView() {
  const me = useMe();
  return (
    <>
      <ShiftCard me={me} />
      <div id="homeExtra"><HomeExtra me={me} /></div>
      <MakeList me={me} />
    </>
  );
}

/** «Сварить сегодня» + «Сварил что-то ещё?» + кнопка «Отметить сваренное» */
function MakeList({ me }: { me: Me }) {
  const { sel, yv, fzv, extraOpen } = useTodayStore();
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const t = me.today, made = t.made || {}, ylds = t.yields || {}, thawed = t.thawed || {}, yEdit = t.yEdit || {};
  const prep = (pid: string) => me.preps.find(x => x.id === pid);
  const unbad = (k: string) => { if (bad.has(k)) setBad(b => { const n = new Set(b); n.delete(k); return n; }); };
  const done = async (r?: { label?: LabelItem[] }) => { invalidate(qk.fridge); haptic('success'); await refreshMe(); askLabel(r?.label); };

  const toggle = (pid: string) => {
    const on = !sel.includes(pid);
    useTodayStore.setState({ sel: on ? [...sel, pid] : sel.filter(x => x !== pid) });
    if (on) setTimeout(() => { const inp = document.querySelector<HTMLInputElement>(`[data-y="${CSS.escape(pid)}"]`); inp?.focus(); inp?.select(); }, 50);
    hapticSelect();
  };

  // «❄️ Разморозил» — вместо варки достали из морозилки
  const thaw = async (it: NeedItem) => {
    const qn = await askQty('❄️ Разморозил: ' + it.name, 'В морозилке ' + fmt(it.frozen) + ' ' + it.unit + '. Срок хранения пойдёт с сегодняшнего дня', Math.min(it.need, it.frozen || 0), it.unit, 'Отметить разморозку');
    if (qn == null) return;
    try {
      const r = await call('thaw', { pid: it.pid, q: qn, today: true });
      useTodayStore.setState(s => ({ sel: s.sel.filter(x => x !== it.pid) }));
      toast('Отмечено ❄️'); await done(r);
    } catch (e) { toast(errMsg(e)); }
  };
  // «✏️ Выход» — исправить итоговый выход у уже отмеченной заготовки
  const editYield = async (pid: string) => {
    const p = prep(pid), cur = ylds[pid];
    const qn = await askQty('✏️ Выход: ' + (p?.name || ''), 'Сейчас записано ' + fmt(cur) + ' ' + (p?.unit || '') + '. Впиши, сколько получилось на самом деле', cur, p?.unit, 'Сохранить');
    if (qn == null || qn === cur) return;
    try { await call('editYield', { pid, q: qn }); toast('Выход исправлен ✅'); await done(); } catch (e) { toast(errMsg(e)); }
  };
  // 🗑 — удалить отметку (холодильник, отчёт и группа откатятся)
  const undo = async (pid: string) => {
    const p = prep(pid);
    if (!(await confirmBox('Удалить отметку «' + (p?.name || '') + '»? ' + (thawed[pid] ? 'Разморозка вернётся в морозилку.' : 'Партия уберётся из холодильника и из отчёта.') + ' Потом можно отметить правильную заготовку.'))) return;
    try { await call('undoMade', { pid }); toast('Отметка удалена'); await done(); } catch (e) { toast(errMsg(e)); }
  };

  const madeRow = (i: Row) => (
    <div className="check made" key={i.pid}>
      <div className="box">✓</div>
      <div className="pname">
        <b>{i.name}</b>
        <span>
          {thawed[i.pid] ? '❄️ разморозил(а)' : 'сварил(а)'} {made[i.pid]}
          {ylds[i.pid] != null ? ' · ' + (thawed[i.pid] ? '' : 'выход ') + fmt(ylds[i.pid]) + ' ' + i.unit : ''}
          {yEdit[i.pid] ? ' · исправил(а) ' + yEdit[i.pid] : ''}
        </span>
      </div>
      {!thawed[i.pid] && ylds[i.pid] != null && <button className="tkbtn" onClick={e => { e.stopPropagation(); editYield(i.pid); }}>✏️ Выход</button>}
      <button className="tkbtn" style={{ marginLeft: 6 }} aria-label="Удалить отметку" onClick={e => { e.stopPropagation(); undo(i.pid); }}>🗑</button>
    </div>
  );

  // поле «Итоговый выход» (у списка сразу стоит план) и «Из них в морозилку» у замораживаемых
  const yieldField = (pid: string, unit: string, dflt: string) => (
    <label className="yld">
      <em>Итоговый выход</em>
      <span className={'field' + (bad.has('y:' + pid) ? ' bad' : '')}>
        <NumInput data-y={pid} enterKeyHint="done" unit={unit} placeholder={dflt ? undefined : '0'} value={yv[pid] ?? dflt}
          onChange={v => { unbad('y:' + pid); useTodayStore.setState(s => ({ yv: { ...s.yv, [pid]: v } })); }} />
        <small>{unit}</small>
      </span>
    </label>
  );
  const fzField = (pid: string, unit: string) => prep(pid)?.frz ? (
    <label className="yld">
      <em>❄️ Из них в морозилку</em>
      <span className={'field' + (bad.has('fz:' + pid) ? ' bad' : '')}>
        <NumInput data-fz={pid} unit={unit} placeholder="0" value={fzv[pid] ?? ''}
          onChange={v => { unbad('fz:' + pid); useTodayStore.setState(s => ({ fzv: { ...s.fzv, [pid]: v } })); }} />
        <small>{unit}</small>
      </span>
    </label>
  ) : null;
  const onRow = (pid: string) => (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest('.yld')) return; toggle(pid); };

  // «Сварил что-то ещё» — заготовки не из списка
  const inList: Record<string, 1> = {};
  t.items.forEach(i => { inList[i.pid] = 1; });
  const extras: Row[] = me.preps.filter(p => !inList[p.id]).map(p => ({ pid: p.id, name: p.name, unit: p.unit || '' }));
  const lastV = me.last?.values || {};
  const open = extraOpen != null ? extraOpen : !t.items.length || extras.some(x => sel.includes(x.pid) || made[x.pid]);
  const pending = t.items.some(i => !made[i.pid]), canMore = extras.some(x => !made[x.pid]);
  const dflt = (pid: string) => { const it = t.items.find(i => i.pid === pid); return it ? fmt(it.need) : ''; };

  const submit = async () => {
    if (!sel.length) return;
    // итоговый выход обязателен по каждой отмеченной заготовке
    const yields: Record<string, number> = {}, badY: string[] = [];
    sel.forEach(pid => { const v = toNum(yv[pid] ?? dflt(pid)); if (v === '' || !(v > 0)) badY.push(pid); else yields[pid] = v; });
    if (badY.length) {
      setBad(new Set(badY.map(p => 'y:' + p)));
      document.querySelector<HTMLInputElement>(`[data-y="${CSS.escape(badY[0])}"]`)?.focus();
      haptic('error'); toast('Впиши итоговый выход'); return;
    }
    const setY = (pid: string) => (v: string) => useTodayStore.setState(s => ({ yv: { ...s.yv, [pid]: v } }));
    const yc: (BigItem & { pid: string })[] = Object.keys(yields).map(pid => ({ pid, v: yields[pid], unit: prep(pid)?.unit, set: setY(pid) }));
    fixBig(yc);
    yc.forEach(c => { yields[c.pid] = c.v; });
    // сколько из сваренного убрали в морозилку (только у заготовок, которые замораживают)
    const freezes: Record<string, number> = {};
    for (const pid of sel) {
      if (!prep(pid)?.frz) continue;
      const raw = toNum(fzv[pid] ?? '');
      if (raw === '' || raw === 0) continue;
      const fc = { v: raw, unit: prep(pid)?.unit, set: (v: string) => useTodayStore.setState(s => ({ fzv: { ...s.fzv, [pid]: v } })) };
      fixBig([fc]);
      if (isNaN(fc.v) || fc.v < 0 || fc.v > yields[pid]) {
        setBad(new Set(['fz:' + pid]));
        document.querySelector<HTMLInputElement>(`[data-fz="${CSS.escape(pid)}"]`)?.focus();
        haptic('error'); toast('В морозилку — не больше, чем сварено'); return;
      }
      freezes[pid] = fc.v;
    }
    setBusy(true);
    try {
      const r = await call('made', { pids: sel, yields, freezes });
      useTodayStore.setState(s => {
        const y = { ...s.yv }, f = { ...s.fzv };
        sel.forEach(pid => { delete y[pid]; delete f[pid]; });
        return { sel: [], yv: y, fzv: f };
      });
      toast('Молодец! 💪');
      await done(r);
    } catch (e) { toast(errMsg(e)); }
    setBusy(false);
  };

  const allDone = t.items.every(i => made[i.pid]);
  return (
    <>
      {t.items.length ? (
        <div className="card">
          <h2>Сварить сегодня</h2>
          <p className="sub">{allDone ? 'Всё готово — спасибо! 🎉' : 'Отметь, что сварил(а)'}</p>
          {t.items.map(i => made[i.pid] ? madeRow(i) : (
            <div key={i.pid} className={'check' + (sel.includes(i.pid) ? ' on' : '')} data-pid={i.pid} onClick={onRow(i.pid)}>
              <div className="box">✓</div>
              <div className="pname">
                <b>{i.name}</b>
                <span>осталось {i.left > 0 ? fmt(i.left) + ' ' + i.unit + ' — почти пусто' : fmt(i.have) + ' ' + i.unit} · норма {fmt(i.norm)}</span>
                {(i.frozen || 0) > 0 && <>
                  <span style={{ display: 'block', color: '#3B5872', marginTop: 2 }}>❄️ в морозилке {fmt(i.frozen)} {i.unit}</span>
                  <button className="tkbtn" style={{ marginTop: 8 }} onClick={e => { e.stopPropagation(); thaw(i); }}>❄️ Не варил, а разморозил</button>
                </>}
                {yieldField(i.pid, i.unit, fmt(i.need))}{fzField(i.pid, i.unit)}
              </div>
              <div className="pill">+{fmt(i.need)} {i.unit}</div>
              {prep(i.pid)?.tk && <button className="tkbtn" onClick={e => { e.stopPropagation(); openTkForPrep(me, i.pid, i.need); }}>ТК</button>}
            </div>
          ))}
        </div>
      ) : t.done?.none ? <Empty icon="🌿" title="Сегодня варить не нужно" text="Всех заготовок хватает." />
        : <Empty icon={me.last ? '🌿' : '🌙'} title={me.last ? 'Всего хватает' : 'Ещё нет подсчёта'} text={me.last ? 'По подсчёту заготовки не нужны.' : 'Остатки внесут вечером на закрытии.'} />}

      {extras.length > 0 && (
        <details className="card" id="extraBox" open={open} onToggle={e => useTodayStore.setState({ extraOpen: (e.currentTarget as HTMLDetailsElement).open })}>
          <summary>
            <div className="pname">
              <h2>{t.items.length ? 'Сварил что-то ещё?' : 'Сварил заготовку?'}</h2>
              <p className="sub">{extras.filter(x => made[x.pid]).length ? 'Отмечено сверх списка: ' + extras.filter(x => made[x.pid]).length : 'Отметь, если сварил(а) то, чего не было в списке'}</p>
            </div>
          </summary>
          {extras.map(x => made[x.pid] ? madeRow(x) : (
            <div key={x.pid} className={'check' + (sel.includes(x.pid) ? ' on' : '')} data-pid={x.pid} onClick={onRow(x.pid)}>
              <div className="box">✓</div>
              <div className="pname">
                <b>{x.name}</b>
                <span>{lastV[x.pid] != null ? 'по подсчёту осталось ' + fmt(lastV[x.pid]) + ' ' + x.unit : 'не было в списке'}</span>
                {yieldField(x.pid, x.unit, '')}{fzField(x.pid, x.unit)}
              </div>
            </div>
          ))}
        </details>
      )}
      {me.preps.length > 0 && <button className="btn soft" style={{ marginTop: 2 }} onClick={() => openSheet(<LateSheet me={me} />)}>📅 Забыл отметить варку? Внести за прошлый день</button>}
      {/* если список сварен, кнопка появляется только когда что-то выбрали в «Сварил что-то ещё» */}
      {(pending || canMore) && (
        <Dock hide={!pending && !sel.length} id="madeDock">
          <button className="btn ok" id="made" disabled={!sel.length || busy} onClick={submit}>
            {busy ? 'Отмечаю…' : sel.length ? '✅ Отметить сваренное (' + sel.length + ')' : 'Выбери, что сварил(а)'}
          </button>
        </Dock>
      )}
    </>
  );
}

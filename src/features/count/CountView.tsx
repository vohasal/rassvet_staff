import { useState } from 'react';
import { invalidate, patchMe, qk, refreshMe, useMe } from '../../api/queries';
import type { CountResult, Me, NeedItem, Prep } from '../../api/types';
import { askDate } from '../../components/ask';
import { NumInput } from '../../components/inputs';
import { NeedRow } from '../../components/NeedRow';
import { PhotoGrid, uploadPhotos } from '../../components/photos';
import { Card, Dock, Empty } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { fmt, fmtTs, parseMoney, tashDay, toNum } from '../../lib/format';
import { confirmBox, haptic, hapticSelect } from '../../lib/telegram';
import { fixBig, type BigItem } from '../../lib/units';
import { toast } from '../../store/ui';
import { CashBlock, chkDone, runChk } from './CashBlock';
import { clearDraft, closeRows, closeSum, setDraft, useCountStore, type Draft, type Row } from './store';

export function CountView() {
  const me = useMe();
  const { lastResult, countReopen } = useCountStore();
  const cz = lastResult || (!countReopen && me.closed);
  if (cz) return <ClosedCard me={me} items={cz.items || []} />;
  if (me.canClose === false) {
    const first = String(me.name || '').split(' ')[0];
    const works = (me.shift || []).some(x => x.name === me.name);
    const who = me.closers && me.closers.length ? 'Сегодня смену закрывает: ' + me.closers.join(', ') : '';
    return <Empty icon={works ? '☕' : '🌿'} title={works ? first + ', ты сегодня не закрываешь, отдыхай💋' : first + ', ты сегодня не работаешь, отдыхай💋'} text={who} />;
  }
  if (!me.preps.length) return <Empty icon="🫙" title="Заготовок пока нет" text={me.isAdmin ? 'Добавь их во вкладке «Заготовки».' : 'Администратор ещё не добавил список.'} />;
  return <CountForm me={me} />;
}

function ClosedCard({ me, items }: { me: Me; items: NeedItem[] }) {
  // «Изменить подсчёт»: возвращаем всё, что отправили (остатки, даты, морозилка, касса, чек-лист, фото)
  const again = () => {
    const { sentCopy } = useCountStore.getState();
    useCountStore.setState({
      lastResult: null, countReopen: true,
      ...(sentCopy ? { draft: structuredClone(sentCopy.draft), checks: [...sentCopy.checks], photos: sentCopy.photos.map(p => ({ ...p })) } : {}),
    });
  };
  return (
    <Card>
      <div className="empty" style={{ paddingBottom: 6 }}>
        <div className="icon">🌙</div>
        <h2>{(me.checklist || []).length ? 'Смена закрыта, спасибо!' : 'Спасибо, остатки отправлены!'}</h2>
        {me.closed?.by ? <p className="sub">Закрыл(а) {me.closed.by}, {fmtTs(me.closed.at)}</p> : null}
      </div>
      {items.length
        ? <><h3>Завтра нужно сварить</h3>{items.map(i => <NeedRow key={i.pid} i={i} />)}</>
        : <div className="status"><span className="big">🌿</span>Всего хватает — завтра варить не нужно</div>}
      <button className="btn soft" onClick={again}>Изменить подсчёт</button>
    </Card>
  );
}

const MIN_PH = 3;
const scrollToBad = () => requestAnimationFrame(() => document.querySelector('#main .bad')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
const pl = (n: number, one: string, few: string, many: string) => n === 1 ? one : n < 5 ? few : many;

function CountForm({ me }: { me: Me }) {
  const { draft, checks, photos, cashChk } = useCountStore();
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const unbad = (k: string) => { if (bad.has(k)) setBad(b => { const n = new Set(b); n.delete(k); return n; }); };

  const cl = me.checklist || [];
  const offs = me.offAsk || [];
  const rowsOf = (p: Prep) => closeRows(p, draft, me);
  const sums = me.preps.map(p => closeSum(rowsOf(p)));
  const filled = sums.filter(s => s !== '').length;
  const cashVal = (k: string) => parseMoney(draft['$' + k] ?? '');
  const cashNow = () => ({ ik: cashVal('ik'), cf: cashVal('cf'), env: cashVal('env') });
  const uploading = photos.some(p => p.loading);

  // что ещё мешает закрыть смену
  const missing = () => {
    const m: string[] = [], cMiss = cl.length - checks.length, ph = photos.filter(p => p.id).length;
    const vMiss = sums.filter(s => s === '').length + me.preps.filter(p => p.frz && String(draft['f:' + p.id] ?? '').trim() === '').length;
    if (cMiss > 0) m.push(cMiss + ' ' + pl(cMiss, 'пункт', 'пункта', 'пунктов'));
    if (ph < MIN_PH) m.push((MIN_PH - ph) + ' фото');
    if (vMiss > 0) m.push(vMiss + ' ' + pl(vMiss, 'остаток', 'остатка', 'остатков'));
    if (['ik', 'cf', 'env'].some(k => !(cashVal(k) >= 0))) m.push('касса');
    else if (cashChk?.res?.short && !chkDone(cashChk)) m.push('разбор недостачи');
    return m;
  };
  const m = missing(), ready = !m.length && !uploading;
  const btnText = sending || (ready ? '🌙 Закрыть смену' : uploading ? '⏳ Загружаю фото…' : '🔒 Осталось: ' + m.join(' · '));

  const toggleCheck = (k: number) => {
    useCountStore.setState(s => ({ checks: s.checks.includes(k) ? s.checks.filter(x => x !== k) : [...s.checks, k] }));
    hapticSelect();
  };

  const offDone = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); invalidate(qk.fridge); haptic('success'); toast(msg); await refreshMe(); } catch (e) { toast(errMsg(e)); }
  };
  const offReturn = async (id: string) => {
    const x = offs.find(y => y.id === id); if (!x) return;
    if (!(await confirmBox(`Вернуть ${x.name} (${fmt(x.q)} ${x.unit})? Партия вернётся в холодильник и уйдёт из отчёта списаний.`))) return;
    offDone(() => call('batchReturn', { id: x.id }), 'Партия возвращена ↩️');
  };

  const send = async () => {
    if (offs.length) {
      toast('Сначала ответь про списанные ботом заготовки'); haptic('error');
      document.querySelector('[data-offok]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // строки по датам и морозилка: сначала поправим 1600 → 1,6, потом проверим числа и даты
    const work: Draft = { ...draft };
    const rowsBy: Record<string, Row[]> = {};
    me.preps.forEach(p => { rowsBy[p.id] = rowsOf(p).map(r => ({ ...r })); });
    const big: BigItem[] = [];
    me.preps.forEach(p => {
      rowsBy[p.id].forEach(r => { const v = toNum(r.q); if (v !== '' && !isNaN(v)) big.push({ v, unit: p.unit, set: t => { r.q = t; } }); });
      if (p.frz) { const v = toNum(work['f:' + p.id] ?? ''); if (v !== '' && !isNaN(v)) big.push({ v, unit: p.unit, set: t => { work['f:' + p.id] = t; } }); }
    });
    fixBig(big);
    me.preps.forEach(p => { if (draft['r:' + p.id] || rowsBy[p.id].some(r => r.q)) work['r:' + p.id] = rowsBy[p.id]; });
    useCountStore.setState({ draft: work });

    const badQ = new Set<string>();
    me.preps.forEach(p => {
      rowsBy[p.id].forEach((r, k) => { const v = toNum(r.q); if (v !== '' && (isNaN(v) || v < 0)) badQ.add(`q:${p.id}:${k}`); });
      if (p.frz) { const v = toNum(work['f:' + p.id] ?? ''); if (v !== '' && (isNaN(v) || v < 0)) badQ.add('f:' + p.id); }
    });
    if (badQ.size) { setBad(badQ); scrollToBad(); toast('Проверь числа — есть ошибка'); haptic('error'); return; }
    // остаток больше нуля — нужна дата с наклейки, и не из будущего
    const td = tashDay(), badD = new Set<string>();
    let future: boolean | null = null;   // по первой ошибке: дата из будущего или даты нет
    me.preps.forEach(p => rowsBy[p.id].forEach((r, k) => {
      const v = toNum(r.q);
      if ((v !== '' && v > 0 && !r.d) || (r.d && r.d > td)) { badD.add(`d:${p.id}:${k}`); if (future === null) future = !!r.d; }
    }));
    if (badD.size) { setBad(badD); scrollToBad(); toast(future ? 'Дата на наклейке не может быть из будущего' : 'Укажи дату с наклейки у каждого остатка'); haptic('error'); return; }

    const values: Record<string, number> = {}, rq: Record<string, { q: number; d: string }[]> = {}, fq: Record<string, number> = {};
    me.preps.forEach(p => {
      const rs = rowsBy[p.id].filter(r => String(r.q).trim() !== '' || r.d), s = closeSum(rs);
      if (s === '') return;
      values[p.id] = toNum(s) as number; rq[p.id] = rs.map(r => ({ q: toNum(r.q) as number, d: r.d }));
    });
    me.preps.filter(p => p.frz).forEach(p => { const v = toNum(work['f:' + p.id] ?? ''); if (v !== '') fq[p.id] = v; });
    const cash = cashNow();
    if (uploading) { toast('Подожди, фото ещё загружаются…'); return; }
    let force = false;
    if (m.length) {
      haptic('error');
      if (!me.isAdmin) { toast('Чтобы закрыть смену, осталось: ' + m.join(', ')); return; }
      if (!(await confirmBox('Не всё заполнено (' + m.join(', ') + '). Ты админ — закрыть смену всё равно?'))) return;
      force = true;
    }
    if (!force) {
      setSending('Проверяю кассу…');
      let ok = false;
      try { ok = await runChk(cash); } catch (e) { toast(errMsg(e)); }
      setSending(null);
      if (!ok) {
        haptic('error');
        if (useCountStore.getState().cashChk?.res?.big) {
          toast('Недостача — пройди 2 шага и объясни своими словами');
          requestAnimationFrame(() => document.getElementById('cashChk')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        }
        return;
      }
    }
    const chk = useCountStore.getState().cashChk;
    const cashWhy = chk?.res?.short ? { s1: !!chk.s1, s2: !!chk.s2, note: (chk.note || '').trim() } : null, cashFirst = chk ? chk.first : null;
    setSending('Отправляю…');
    try {
      const st = useCountStore.getState();
      const r = await call<CountResult>('count', { values, rq, fq, checks: st.checks, photos: st.photos.filter(p => p.id).map(p => p.id), force, cash, cashWhy, cashFirst });
      useCountStore.setState({
        lastResult: r, countReopen: false, cashChk: null,
        sentCopy: { draft: structuredClone(st.draft), checks: [...st.checks], photos: st.photos.filter(p => p.id).map(p => ({ ...p })) },
        draft: {}, checks: [], photos: [],
      });
      clearDraft();
      patchMe({ closed: { by: me.name, at: Date.now(), items: r.items || [] } });
      invalidate(qk.history);
      await refreshMe();
      haptic('success');
      window.scrollTo(0, 0);
      askExtras(r.extra);
    } catch (e) { toast(errMsg(e)); setSending(null); }
  };

  return (
    <>
      {cl.length > 0 && (
        <Card>
          <h2>Чек-лист закрытия</h2>
          <p className="sub">Отмечено {checks.length} из {cl.length}</p>
          {cl.map((t, k) => (
            <div key={k} className={'check' + (checks.includes(k) ? ' on' : '')} onClick={() => toggleCheck(k)}>
              <div className="box">✓</div><div className="pname"><b>{t}</b></div>
            </div>
          ))}
        </Card>
      )}
      <Card>
        <h2>Фото закрытия</h2>
        <p className="sub">Бар, витрина, мойка — <b>минимум 3</b>, до 10 фото</p>
        <PhotoGrid photos={photos} max={10} zoom
          onRemove={i => useCountStore.setState(s => ({ photos: s.photos.filter((_, k) => k !== i) }))}
          onAdd={files => uploadPhotos(files, 'photoUpload', fn => useCountStore.setState(s => ({ photos: fn(s.photos) })), { errText: e => 'Фото не загрузилось: ' + errMsg(e) })} />
      </Card>
      <CashBlock me={me} />
      {offs.length > 0 && (
        <Card>
          <h2>🗑 Бот списал — вылили?</h2>
          <p className="sub">Эти заготовки бот списал по сроку. Вылили — жми «✅ Вылили». Заготовка на месте и ещё живая — «↩️ Вернуть». Пока не ответишь по каждой, остатки не внести</p>
          {offs.map(x => (
            <div className="batch" key={x.id}>
              <div className="pname">
                <b>{x.name} · {fmt(x.q)} {x.unit}</b>
                <span>партия от {new Date(x.made).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                <div className="acts" style={{ marginTop: 8 }}>
                  <button className="tkbtn" data-offok={x.id} onClick={() => offDone(() => call('autoOffOk', { id: x.id }), 'Отмечено: вылили 🗑')}>✅ Вылили</button>
                  <button className="tkbtn" onClick={() => offReturn(x.id)}>↩️ Вернуть</button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
      <Card>
        <h2>Остатки заготовок</h2>
        {me.last ? <p className="sub">Последний подсчёт: {me.last.by}, {fmtTs(me.last.ts)}</p> : <p className="sub">Внеси, сколько осталось каждой заготовки</p>}
        {offs.length > 0 && <p className="sub" style={{ color: 'var(--danger)' }}>Сначала ответь про списанные ботом заготовки выше ☝️</p>}
        <div style={offs.length ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
          <div className="progress"><i style={{ width: (filled / me.preps.length) * 100 + '%' }} /></div>
          <p className="sub" style={{ margin: '0 0 4px' }}>Заполнено {filled} из {me.preps.length}</p>
          {me.preps.map((p, i) => <PrepBlock key={p.id} p={p} rows={rowsOf(p)} sum={sums[i]} frz={String(draft['f:' + p.id] ?? '')} bad={bad} unbad={unbad} />)}
        </div>
      </Card>
      <Dock>
        <button className={'btn' + (ready ? '' : ' locked')} disabled={!!sending} onClick={send}>{btnText}</button>
      </Dock>
    </>
  );
}

/** Заготовка: строки «остаток + дата» (плюсик — ещё дата), сверху сумма; у замораживаемых — ещё морозилка */
function PrepBlock({ p, rows, sum, frz, bad, unbad }: { p: Prep; rows: Row[]; sum: string; frz: string; bad: Set<string>; unbad: (k: string) => void }) {
  const low = sum !== '' && (toNum(sum) as number) < p.min;
  const many = rows.length > 1, td = tashDay();
  const boxId = 'rp-' + p.id;
  const setRows = (next: Row[], focusK?: number) => {
    setDraft('r:' + p.id, next);
    if (focusK != null) setTimeout(() => document.querySelectorAll<HTMLInputElement>(`#${CSS.escape(boxId)} [data-rq]`)[focusK]?.focus(), 0);
  };
  const upd = (k: number, patch: Partial<Row>) => setRows(rows.map((r, i) => (i === k ? { ...r, ...patch } : r)));
  // нажали на сумму — к первому пустому полю
  const focusEmpty = () => {
    const ins = [...document.querySelectorAll<HTMLInputElement>(`#${CSS.escape(boxId)} [data-rq]`)];
    (ins.find(x => x.value.trim() === '') || ins[0])?.focus();
  };
  return (
    <div className="pblock">
      <div className={'prow' + (low ? ' low' : '')}>
        <div className="pname">
          <b>{p.name}<span className="tag">варить</span></b>
          <span>минимум {fmt(p.min)} {p.unit}{p.frz ? ' · сумма — без морозилки' : ''}</span>
        </div>
        <label className="field">
          <input inputMode="decimal" data-id={p.id} value={sum} placeholder="сумма" readOnly tabIndex={-1} onClick={focusEmpty} />
          <small>{p.unit}</small>
        </label>
      </div>
      <div className="bsub" id={boxId}>
        <div className="bcap">Сколько осталось · дата на наклейке</div>
        {rows.map((r, k) => (
          <div className="brow" key={k}>
            <label className={'field' + (bad.has(`q:${p.id}:${k}`) ? ' bad' : '')}>
              <NumInput enterKeyHint="next" data-rq={p.id} unit={p.unit} value={r.q} placeholder="0"
                onChange={t => { unbad(`q:${p.id}:${k}`); upd(k, { q: t }); }} />
              <small>{p.unit}</small>
            </label>
            <input type="date" className={'bdate' + (bad.has(`d:${p.id}:${k}`) ? ' bad' : '')} value={r.d || ''} max={td}
              onChange={e => { unbad(`d:${p.id}:${k}`); upd(k, { d: e.target.value }); }} />
            {many && <button className="bbtn del" aria-label="Убрать строку" onClick={() => { const n = rows.filter((_, i) => i !== k); setRows(n.length ? n : [{ q: '', d: '' }]); }}>×</button>}
            {k === rows.length - 1 && <button className="bbtn" aria-label="Ещё дата" onClick={() => { setRows([...rows, { q: '', d: '' }], rows.length); hapticSelect(); }}>+</button>}
          </div>
        ))}
        {p.frz && (
          <div className="brow">
            <span className="frzl">❄️ В морозилке</span>
            <label className={'field' + (bad.has('f:' + p.id) ? ' bad' : '')}>
              <NumInput enterKeyHint="next" unit={p.unit} value={frz} placeholder="0" onChange={t => { unbad('f:' + p.id); setDraft('f:' + p.id, t); }} />
              <small>{p.unit}</small>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

/** Посчитали больше, чем в партиях: спрашиваем дату с наклейки и заводим партию. «Отмена» — пропустить */
async function askExtras(list: CountResult['extra']) {
  const today = tashDay();
  for (const x of list || []) {
    if (x.back && (await confirmBox(`${x.name}: посчитали больше, чем в партиях. Бот списал партию от ${new Date(x.back.made).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, а она, похоже, на месте. Вернуть её?`))) {
      try { await call('batchReturn', { id: x.back.id }); invalidate(qk.fridge); toast('Партия возвращена ↩️'); } catch (e) { toast(errMsg(e)); }
      continue;
    }
    const date = await askDate('🏷 ' + x.name + ': лишние ' + fmt(x.q) + ' ' + x.unit, 'Посчитали больше, чем отмечено в партиях. Какая дата на наклейке?', today, 'Завести партию');
    if (!date) continue;
    try { await call('batchExtra', { pid: x.pid, date }); invalidate(qk.fridge); toast('Партия заведена ✅'); }
    catch (e) { toast(errMsg(e)); }
  }
}

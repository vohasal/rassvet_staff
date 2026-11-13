import { Fragment } from 'react';
import type { CashPreview, Me } from '../../api/types';
import { Card } from '../../components/ui';
import { call } from '../../lib/api';
import { money, parseMoney } from '../../lib/format';
import { openCashFormLoaded } from '../cash/CashForm';
import { setDraft, useCountStore, type CashChk } from './store';

const FIELDS: [k: string, label: string, ph: string, hint: 'next' | 'done'][] = [
  ['ik', 'Наличные по отчёту iiko', 'Сумма из распечатки iiko', 'next'],
  ['cf', '💵 Пересчитай кассу — сколько наличных по факту', 'Например: 1 150 000', 'next'],
  ['env', '✉️ Пересчитай конверт — сколько в нём сейчас', 'Например: 2 350 000', 'done'],
];

const cashNow = () => {
  const d = useCountStore.getState().draft, v = (k: string) => parseMoney(d['$' + k] ?? '');
  return { ik: v('ik'), cf: v('cf'), env: v('env') };
};

/** Разбор недостачи пройден: оба шага и объяснение своими словами */
export const chkDone = (c: CashChk | null) =>
  !!(c && c.s1 && c.s2 && (c.note || '').trim().length >= ((c.res && c.res.noteMin) || 15) && (c.note || '').trim().split(/\s+/).length >= 2);

/** Проверка кассы на сервере. true — можно закрывать */
export async function runChk(cash: ReturnType<typeof cashNow>): Promise<boolean> {
  const r = await call<CashPreview>('cashPreview', { cash });
  const prev = useCountStore.getState().cashChk;
  const next: CashChk = { ...(prev || { first: { kd: r.kd, ed: r.ed }, s1: false, s2: false, note: '' }), res: r };
  useCountStore.setState({ cashChk: next });
  return !r.short || chkDone(next);
}

const setChk = (p: Partial<CashChk>) => useCountStore.setState(s => ({ cashChk: s.cashChk ? { ...s.cashChk, ...p } : s.cashChk }));

export function CashBlock({ me }: { me: Me }) {
  const draft = useCountStore(s => s.draft);
  const o = me.cashOut || {};
  const parts = [o.exp ? 'расходы ' + money(o.exp) : '', o.toEnv ? 'в конверт ' + money(o.toEnv) : ''].filter(Boolean);
  return (
    <Card>
      <h2>💵 Касса и конверт</h2>
      <p className="sub">Без этого смену не закрыть. Суммы в сумах, можно писать «4 500 000» или «4500к»</p>
      <div className="form">
        {FIELDS.map(([k, label, ph, hint]) => (
          <Fragment key={k}>
            <label>{label}</label>
            <input id={'cash-' + k} inputMode="text" enterKeyHint={hint} placeholder={ph} value={String(draft['$' + k] ?? '')}
              onChange={e => { setDraft('$' + k, e.target.value); if (useCountStore.getState().cashChk) setChk({ res: null }); }} />
          </Fragment>
        ))}
      </div>
      {/* что уже записано из кассы через «Наличные» (бот вычтет это из остатка iiko) */}
      <p className="sub" style={{ marginTop: 10 }}>
        {(parts.length ? 'Из кассы за сегодня записано: ' + parts.join(', ') + '. ' : 'Из кассы за сегодня ничего не записано. ') +
          'Если что-то брали из кассы и не записали — сначала внеси во вкладке «Наличные».'}
      </p>
      <CashCheck />
    </Card>
  );
}

/** Разница больше ±20 000 → подсказка, исправить на месте, иначе — объяснить причину */
function CashCheck() {
  const chk = useCountStore(s => s.cashChk);
  const r = chk?.res;
  if (!chk || !r || !r.big) return <div id="cashChk" />;

  const line = (ic: string, nm: string, d: number) => Math.abs(d) > r.tol
    ? <>{ic} {nm}: {d > 0 ? 'лишние ' : <b>недостача </b>}{money(Math.abs(d))}</>
    : <>{ic} {nm} сходится</>;
  const nums = <p style={{ margin: '6px 0 0' }}>{line('🧾', 'Касса', r.kd)}{r.known && <><br />{line('✉️', 'Конверт', r.ed)}</>}</p>;
  const after = async () => { await runChk(cashNow()); };
  const fixBtns = (
    <div className="chips" style={{ marginTop: 8 }}>
      <button className="chip" onClick={() => openCashFormLoaded('exp', after, { src: Math.abs(r.kd) > r.tol || !r.known ? 'kassa' : 'env' })}>− Забытый расход</button>
      <button className="chip" onClick={() => openCashFormLoaded('in', after, { from: r.kd > r.tol || (r.kd < -r.tol && r.ed > r.tol) ? 'kassa' : '' })}>+ Внесение в конверт</button>
    </div>
  );
  const hint = r.hint?.text ? <p style={{ margin: '8px 0 0' }}>💡 {r.hint.text}</p> : null;
  const boxStyle = { marginTop: 12, padding: 12, borderRadius: 14, background: 'var(--warm-soft)', color: 'var(--forest)' };

  // излишек: только подсказка, закрывать не мешает
  if (!r.short) return <div id="cashChk"><div style={boxStyle}><b>💰 Лишние деньги</b>{nums}{hint}{fixBtns}</div></div>;

  const nl = (chk.note || '').trim().length;
  const step = (k: 's1' | 's2', n: number, t: string) => (
    <button className={'chip' + (chk[k] ? ' on' : '')} style={{ display: 'block', width: '100%', textAlign: 'left', margin: '6px 0', whiteSpace: 'normal' }}
      onClick={() => {
        const on = !chk[k]; setChk({ [k]: on });
        if (k === 's1' && on) { const i = document.getElementById('cash-cf') as HTMLInputElement | null; i?.focus(); i?.select(); }
      }}>
      {chk[k] ? '' : '⬜️ '}<b>Шаг {n}.</b> {t}
    </button>
  );
  return (
    <div id="cashChk">
      <div style={boxStyle}>
        <b>⚠️ Недостача больше 20 000</b>{nums}{hint}
        {r.hint?.ops?.length ? <>
          <p className="sub" style={{ margin: '8px 0 2px' }}>Что записано — сверь с тем, что брали на самом деле:</p>
          {r.hint.ops.map((o, i) => (
            <div key={i} style={{ fontSize: 14, margin: '2px 0' }}>
              {o.near ? <>👉 <b>{money(o.a)} — {o.what}</b></> : <>• {money(o.a)} — {o.what}</>}{o.by ? <> · <i>{o.by}</i></> : null}
            </div>
          ))}
        </> : null}
        <p className="sub" style={{ margin: '12px 0 2px' }}>Разберись, без этого смену не закрыть:</p>
        {step('s1', 1, 'Пересчитал(а) кассу и конверт ещё раз и вписал(а) точные суммы')}
        {step('s2', 2, 'Проверил(а): все расходы и внесения за смену записаны во вкладке «Наличные»')}
        {fixBtns}
        <p className="sub" style={{ margin: '12px 0 4px' }}>Объясни своими словами, откуда недостача:</p>
        <div className="form">
          <textarea maxLength={300} rows={3} placeholder="Например: дал сдачу 50 000 вместо 5 000 гостю за 3-м столом"
            value={chk.note || ''} onChange={e => setChk({ note: e.target.value })} />
        </div>
        <p className="sub" style={{ margin: '2px 0 0' }}>{nl >= r.noteMin ? '✅ Объяснение есть' : 'Ещё ' + (r.noteMin - nl) + ' знаков минимум'}</p>
      </div>
    </div>
  );
}

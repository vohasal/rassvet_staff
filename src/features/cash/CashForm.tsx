import { useState } from 'react';
import { Sheet } from '../../components/overlays';
import { qk, queryClient } from '../../api/queries';
import type { CashData, CashOp } from '../../api/types';
import { call, errMsg } from '../../lib/api';
import { dmy, money, parseMoney } from '../../lib/format';
import { confirmBox, haptic } from '../../lib/telegram';
import { closeSheet, openSheet, toast } from '../../store/ui';

type Kind = 'exp' | 'in';
interface St { src: string; kd: string; cat: string; person: string; amount: string; note: string; back: boolean; from: string }
const DAY_LBL = ['Сегодня', 'Вчера', 'Позавчера'];

/**
 * Окошко расхода / внесения. op — запись для исправления.
 * onDone — вызвать после записи (форма открыта с «Закрытия»); pre — что выбрать заранее
 */
export function openCashForm(d: CashData, kind: Kind, op?: CashOp | null, onDone?: () => void, pre?: Partial<St>) {
  openSheet(<CashForm d={d} kind={kind} op={op || null} onDone={onDone} pre={pre} />);
}

/** Загрузить кассу (если ещё нет) и открыть форму */
export async function openCashFormLoaded(kind: Kind, onDone?: () => void, pre?: Partial<St>) {
  try {
    const d = await queryClient.ensureQueryData({ queryKey: qk.cash, queryFn: () => call<CashData>('cash') });
    openCashForm(d, kind, null, onDone, pre);
  } catch (e) { toast(errMsg(e)); }
}

function CashForm({ d, kind, op, onDone, pre }: { d: CashData; kind: Kind; op: CashOp | null; onDone?: () => void; pre?: Partial<St> }) {
  const [st, setSt] = useState<St>(() => op
    ? { src: op.src, kd: op.kd || d.today, cat: op.cat || '', person: op.person || '', amount: String(op.amount), note: op.note || '', back: false, from: op.from || '' }
    : { src: 'kassa', kd: d.today, cat: '', person: '', amount: '', note: '', back: false, from: '', ...pre });
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<St>) => setSt(s => ({ ...s, ...p }));
  const isExp = kind === 'exp', a = parseMoney(st.amount);
  const amtHint = a > 0 ? '= ' + money(a) : st.amount.trim() ? 'Не понял сумму — пиши цифрами, например 200 000' : '';

  const send = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await call<CashData>(op ? 'cashEdit' : 'cashAdd', payload);
      queryClient.setQueryData(qk.cash, r);
      haptic('success');
      toast(payload.cancel ? 'Запись отменена' : op ? 'Исправлено ✅' : kind === 'exp' ? 'Расход записан ✅' : 'Внесено ✅');
      closeSheet(); onDone?.();
    } catch (e) { toast(errMsg(e)); setBusy(false); }
  };
  const save = () => {
    const amount = parseMoney(st.amount);
    if (!(amount > 0)) return toast('Впиши сумму');
    if (kind === 'exp' && !st.cat) return toast('Выбери, на что потратили');
    if (kind === 'in' && !st.from) return toast('Выбери, откуда деньги');
    if (st.cat === 'ЗП стажёру' && !st.person) return toast('Выбери, кому ЗП');
    if (st.cat === 'Другое' && !st.note.trim()) return toast('Напиши название расхода');
    send({ kind, amount, note: st.note.trim(), src: st.src, kd: st.kd, cat: st.cat, from: st.from, person: st.cat === 'ЗП стажёру' ? st.person : '', back: st.back, ...(op ? { id: op.id } : {}) });
  };
  const cancelOp = async () => { if (await confirmBox('Отменить эту запись? Она останется в истории зачёркнутой.')) send({ id: op!.id, cancel: true }); };

  const dayChips = <div className="chips">{d.days.map((x, i) => <Chip key={x} on={st.kd === x} label={DAY_LBL[i] + ' ' + dmy(x)} onClick={() => up({ kd: x })} />)}</div>;
  const noteLabel = isExp && st.cat === 'Другое' ? 'Название расхода *' : isExp ? 'Описание (необязательно)' : 'Комментарий (необязательно)';
  const notePh = isExp && st.cat === 'Другое' ? 'Например: ремонт кофемолки' : isExp ? 'Например: 10 батонов' : 'Например: из кассы за 19.10';
  // «задним числом» — только админ и только для конверта
  const showBack = isAdminNow() && !op && (isExp ? st.src === 'env' : st.from !== 'kassa');

  return (
    <Sheet>
      <h2>{op ? '✏️ Исправить запись' : isExp ? '− Расход наличными' : '+ Внести в конверт'}</h2>
      {isExp ? (
        <>
          <p className="sub" style={{ marginTop: 4 }}>Откуда взяли деньги</p>
          <div className="chips"><Chip on={st.src === 'kassa'} label={'Касса'} onClick={() => up({ src: 'kassa' })} /><Chip on={st.src === 'env'} label={'✉️ Конверт'} onClick={() => up({ src: 'env' })} /></div>
          {st.src === 'kassa' && <><p className="sub" style={{ marginTop: 10 }}>Касса за какой день</p>{dayChips}</>}
          <p className="sub" style={{ marginTop: 10 }}>На что потратили</p>
          <div className="chips">{d.cats.map(c => <Chip key={c} on={st.cat === c} label={c} onClick={() => up({ cat: c })} />)}</div>
          {st.cat === 'ЗП стажёру' && <>
            <p className="sub" style={{ marginTop: 10 }}>Кому</p>
            <div className="chips">{d.people.map(n => <Chip key={n} on={st.person === n} label={n} onClick={() => up({ person: n })} />)}</div>
          </>}
        </>
      ) : (
        <>
          <p className="sub" style={{ marginTop: 4 }}>Откуда деньги</p>
          <div className="chips"><Chip on={st.from === 'kassa'} label={'Из кассы'} onClick={() => up({ from: 'kassa' })} /><Chip on={st.from === 'other'} label={'Принесли со стороны'} onClick={() => up({ from: 'other' })} /></div>
          {st.from === 'kassa' && <><p className="sub" style={{ marginTop: 10 }}>Из кассы за какой день</p>{dayChips}</>}
        </>
      )}
      <div className="form">
        <label>Сумма</label>
        <input inputMode="text" placeholder="Например: 200 000 или 200к" value={st.amount} onChange={e => up({ amount: e.target.value })} />
        <p className="sub" style={{ margin: '6px 2px 0' }}>{amtHint}</p>
        <label>{noteLabel}</label>
        <input maxLength={200} placeholder={notePh} value={st.note} onChange={e => up({ note: e.target.value })} />
      </div>
      {showBack && (
        <div className={'check' + (st.back ? ' on' : '')} style={{ marginTop: 10 }} onClick={() => up({ back: !st.back })}>
          <div className="box">✓</div>
          <div className="pname"><b>Задним числом</b><span>Деньги уже учтены в последнем пересчёте конверта — на «должно быть» не повлияет</span></div>
        </div>
      )}
      <button className="btn" disabled={busy} onClick={save}>{op ? 'Сохранить' : isExp ? 'Записать расход' : 'Внести'}</button>
      {op && <button className="btn soft" disabled={busy} onClick={cancelOp}>Отменить запись</button>}
      <button className="btn soft" onClick={closeSheet}>Закрыть</button>
    </Sheet>
  );
}

const Chip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) =>
  <button className={'chip' + (on ? ' on' : '')} onClick={onClick}>{label}</button>;

const isAdminNow = () => !!queryClient.getQueryData<{ isAdmin?: boolean }>(qk.me)?.isAdmin;

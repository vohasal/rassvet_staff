import { useCash } from '../../api/queries';
import type { CashData, CashOp } from '../../api/types';
import { Await, Card } from '../../components/ui';
import { dmy, hhmm, money } from '../../lib/format';
import { openCashForm } from './CashForm';

const DAY_LBL = ['Сегодня', 'Вчера', 'Позавчера'];

export default function CashView() {
  const q = useCash();
  return <Await q={q}>{d => <Cash d={d} />}</Await>;
}

function Cash({ d }: { d: CashData }) {
  return (
    <>
      <Card>
        <h2>💵 Наличные</h2>
        <p className="sub">Потратил из кассы или из конверта — сразу запиши сюда. Положил деньги в конверт — нажми «+ Внести»</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ flex: 1, marginTop: 0 }} onClick={() => openCashForm(d, 'exp')}>− Расход</button>
          <button className="btn ok" style={{ flex: 1, marginTop: 0 }} onClick={() => openCashForm(d, 'in')}>+ Внести</button>
        </div>
      </Card>
      {d.env && (
        <Card>
          <h2>✉️ Конверт</h2>
          {d.env.known ? <>
            <div style={{ fontSize: 30, fontWeight: 700, margin: '6px 0 0', whiteSpace: 'nowrap' }}>{money(d.env.exp)}</div>
            <p className="sub" style={{ margin: 0 }}>сейчас в конверте — по последнему пересчёту и записям</p>
            <p className="sub" style={{ margin: '8px 0 0' }}>Пересчёт {dmy(d.env.baseDate)} ({d.env.baseBy}): {money(d.env.base)} · + внесения {money(d.env.ins)} · − расходы {money(d.env.exps)}</p>
          </> : <p className="sub">Пересчёта ещё не было — первый будет на закрытии смены, с него бот начнёт считать остаток.</p>}
        </Card>
      )}
      {d.days.map((day, i) => {
        const ops = d.ops.filter(o => o.date === day);
        if (!ops.length && i) return null;
        const live = ops.filter(o => !o.canceled), sum = (f: (o: CashOp) => boolean) => live.filter(f).reduce((a, o) => a + o.amount, 0);
        const kx = sum(o => o.kind === 'exp' && o.src === 'kassa'), ex = sum(o => o.kind === 'exp' && o.src === 'env'), inn = sum(o => o.kind === 'in');
        return (
          <Card key={day}>
            <h2>{DAY_LBL[i]} · {dmy(day)}</h2>
            {ops.length ? <>
              <p className="sub">{[kx ? 'из кассы −' + money(kx) : '', ex ? 'из конверта −' + money(ex) : '', inn ? 'в конверт +' + money(inn) : ''].filter(Boolean).join(' · ') || 'всё отменено'}</p>
              {ops.map(o => <OpRow key={o.id} o={o} onEdit={() => openCashForm(d, o.kind, o)} />)}
            </> : <p className="sub">Записей пока нет</p>}
          </Card>
        );
      })}
    </>
  );
}

function OpRow({ o, onEdit }: { o: CashOp; onEdit: () => void }) {
  return (
    <div className="task" style={o.canceled ? { opacity: 0.5 } : undefined}>
      <div className="pname">
        <b style={o.canceled ? { textDecoration: 'line-through' } : undefined}>{o.kind === 'in' ? '+' : '−'}{money(o.amount)} · {o.what}</b>
        <span>{o.srcLabel} · {o.byName} · {hhmm(o.at)}{o.canceled ? ' · отменено' : o.edited ? ' · исправлено' : ''}{o.back ? ' · задним числом' : ''}</span>
      </div>
      {o.canEdit && <button className="tkbtn" onClick={onEdit}>✏️</button>}
    </div>
  );
}

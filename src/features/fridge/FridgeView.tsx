import { invalidate, qk, refreshMe, useFridge } from '../../api/queries';
import type { Batch, FridgeData, LabelItem } from '../../api/types';
import { askDate, askLabel, askQty } from '../../components/ask';
import { Await, Card } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { fmt, plural } from '../../lib/format';
import { confirmBox, haptic } from '../../lib/telegram';
import { toast } from '../../store/ui';

export default function FridgeView() {
  const q = useFridge();
  return <Await q={q}>{d => <Fridge d={d} />}</Await>;
}

const dd = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const tz = (ts: number) => new Date(ts + 5 * 36e5).toISOString().slice(0, 10);   // дата в Ташкенте

/** Действие с партией: запрос → обновить холодильник и «me» → наклейка, если нужна */
async function act(action: string, data: unknown, okMsg: string) {
  try {
    const r = await call<{ label?: LabelItem[] }>(action, data);
    invalidate(qk.fridge); haptic('success'); toast(okMsg);
    await refreshMe();
    askLabel(r?.label);
  } catch (e) { toast(errMsg(e)); }
}

function Fridge({ d }: { d: FridgeData }) {
  const now = Date.now(), ed = d.canEdit;
  const work = d.batches.filter(x => x.state === 'w'), frozen = d.batches.filter(x => x.state === 'f');
  const offs = d.autoOff || [];

  const used = async (x: Batch) => { if (await confirmBox(`${x.name} закончилась? Партия уберётся из списка.`)) act('batchDone', { id: x.id }, 'Убрано ✅'); };
  const waste = async (x: Batch) => {
    const qn = await askQty('🗑 Списать: ' + x.name, 'Сколько выкинули? Попадёт в отчёт о списаниях, партия уберётся из списка', '', x.unit, 'Списать');
    if (qn != null) act('batchDone', { id: x.id, waste: true, q: qn }, 'Списано 🗑');
  };
  const alive = async (x: Batch) => {
    const date = await askDate('👌 Ещё живая: ' + x.name, 'В боте партия от ' + dd(x.made) + '. Посмотри на наклейку и выбери дату с неё. Для размороженной — дату разморозки', tz(Date.now()), 'Подтвердить');
    if (!date) return;
    try {
      const r = await call<{ check?: boolean; was?: number }>('batchAlive', { id: x.id, date });
      if (r?.check) {
        const was = dd(r.was!), now2 = new Date(date + 'T12:00:00+05:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const sure = await confirmBox(`На наклейке ${now2}, а в боте эта партия от ${was} — она старше. Перепроверь холодильник: нет ли там ещё ${x.name} от ${was}? Нажми «ОК», если старой нет: бот поправит дату, а старую партию посчитает закончившейся.`);
        if (!sure) { toast('Тогда отметь старую партию: «Ещё живая» с её датой, «Закончилась» или «Списать»'); return; }
        await call('batchAlive', { id: x.id, date, sure: true });
      }
      invalidate(qk.fridge); haptic('success');
      toast(date === tz(x.made) ? 'Ок, проверим завтра 👌' : 'Дату исправили по наклейке ✅');
      await refreshMe();
    } catch (e) { toast(errMsg(e)); }
  };
  const thaw = async (pid: string) => {
    const all = d.batches.filter(x => x.pid === pid && x.state === 'f'), tot = all.reduce((a, x) => a + x.q, 0);
    const qn = await askQty('❄️ Разморозить: ' + all[0].name, 'В морозилке ' + fmt(tot) + ' ' + all[0].unit + '. Сначала берём самые старые партии', '', all[0].unit, 'Разморозить');
    if (qn != null) act('thaw', { pid, q: qn }, 'Разморожено ❄️');
  };
  const freeze = async (pid: string) => {
    const p = d.frz.find(x => x.id === pid); if (!p) return;
    const qn = await askQty('❄️ В морозилку: ' + p.name, 'Сколько положили в морозилку', '', p.unit, 'Положить');
    if (qn != null) act('freeze', { pid: p.id, q: qn }, 'Убрано в морозилку ❄️');
  };
  const giveBack = async (id: string) => {
    const x = offs.find(y => y.id === id); if (!x) return;
    if (!(await confirmBox(`Вернуть ${x.name} (${fmt(x.q)} ${x.unit})? Партия вернётся в холодильник и уйдёт из отчёта списаний. Потом отметь её: «Ещё живая» с датой с наклейки или «Закончилась».`))) return;
    act('batchReturn', { id: x.id }, 'Партия возвращена ↩️');
  };

  const badge = (x: Batch) => {
    if (!x.exp) return <span className="days">срок не указан</span>;
    const L = (x.exp - now) / 864e5;
    if (L < 0) return <span className="days today">срок истёк</span>;
    const n = Math.ceil(L);
    if (x.state === 'f') return <span className="days frz">❄️ {n} {plural(n, 'день', 'дня', 'дней')}</span>;
    return <span className={'days' + (n <= 1 ? ' today' : n <= 2 ? ' soon' : '')}>{n <= 1 ? 'последний день' : 'ещё ' + n + ' ' + plural(n, 'день', 'дня', 'дней')}</span>;
  };
  const wasteBtn = (x: Batch) => <button className="tkbtn" style={{ background: 'var(--warm-soft)', color: 'var(--danger)' }} onClick={() => waste(x)}>🗑 Списать</button>;
  const markBtn = (x: Batch) => x.mark ? <button className="tkbtn" onClick={() => act('batchMark', { ids: [x.id] }, 'Промаркировано 🏷')}>🏷 Промаркировал(а)</button> : null;

  const row = (x: Batch) => {
    const fz = x.state === 'f';
    const who = fz ? 'заморозил(а)' : x.thaw ? 'разморозил(а)' : x.cnt ? 'завёл(а) на закрытии' : 'сварил(а)';
    const was = x.q0 && !(fz && Math.abs(x.q0 - x.q) < 0.001) ? ' · ' + (fz ? 'было ' : '') + fmt(x.q0) + ' ' + x.unit : '';
    const left = !fz && (!x.q0 || Math.abs(x.q0 - x.q) > 0.001) ? ' · осталось ' + fmt(x.q) + ' ' + x.unit : '';
    return (
      <div className="batch" key={x.id}>
        <div className="pname">
          <b>{x.name}{fz ? ' · ' + fmt(x.q) + ' ' + x.unit : ''}</b>
          <span>{dd(x.made)} · {who} {x.by || '—'}{was}{left}{x.ext ? ' · продлевали ' + x.ext + ' р.' : ''}</span>
          {x.mark && <span style={{ color: 'var(--danger)' }}>🏷 Не промаркирована</span>}
          {ed && (
            <div className="acts" style={{ marginTop: 8 }}>
              {fz ? <>
                {markBtn(x)}
                <button className="tkbtn" onClick={() => thaw(x.pid)}>❄️ Разморозить</button>
                <button className="tkbtn" onClick={() => used(x)}>Закончилась</button>
                {wasteBtn(x)}
              </> : <>
                {markBtn(x)}
                {x.exp && x.exp < now && (x.aliveBlock
                  ? <span className="sub" style={{ width: '100%' }}>{x.aliveBlock === 'limit' ? 'Продлили 7 раз: дальше решает управляющий' : 'Сегодня уже продлили, следующий раз завтра'}</span>
                  : <button className="tkbtn" onClick={() => alive(x)}>👌 Ещё живая</button>)}
                <button className="tkbtn" onClick={() => used(x)}>Закончилась</button>
                {wasteBtn(x)}
              </>}
            </div>
          )}
        </div>
        {badge(x)}
      </div>
    );
  };

  return (
    <>
      <Card>
        <h2>🧊 В работе</h2>
        <p className="sub">{work.length ? 'Сверху — то, что истекает раньше. Срок вышел, а заготовка ещё живая — жми «👌 Ещё живая», проверим завтра. Партии от этой даты нет — «Закончилась»' : 'Партии появятся, когда сотрудники отметят сваренные заготовки'}</p>
        {work.map(row)}
      </Card>
      {(d.frz.length > 0 || frozen.length > 0) && (
        <Card>
          <h2>❄️ В морозилке</h2>
          <p className="sub">{frozen.length ? 'Срок хранения после разморозки считается с дня разморозки' : 'Пока пусто'}</p>
          {frozen.map(row)}
          {ed && d.frz.map(p => <button key={p.id} className="btn soft" style={{ padding: 11 }} onClick={() => freeze(p.id)}>＋ Положить в морозилку: {p.name}</button>)}
        </Card>
      )}
      {offs.length > 0 && (
        <Card>
          <h2>🗑 Списано ботом</h2>
          <p className="sub">Просрочку до 16:00 никто не проверил, и бот списал её сам. Заготовку не выбросили и она ещё живая — жми «↩️ Вернуть», партия вернётся и уйдёт из отчёта списаний</p>
          {offs.map(x => (
            <div className="batch" key={x.id}>
              <div className="pname">
                <b>{x.name} · {fmt(x.q)} {x.unit}</b>
                <span>от {dd(x.made)} · вернуть можно до конца {dd(x.till)}</span>
                {ed && <div className="acts" style={{ marginTop: 8 }}><button className="tkbtn" onClick={() => giveBack(x.id)}>↩️ Вернуть</button></div>}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

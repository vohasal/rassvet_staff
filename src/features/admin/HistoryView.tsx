// История закрытий за 7 дней + кнопки отчётов для админа
import { useState } from 'react';
import { useHistory, useMe } from '../../api/queries';
import type { Closing, Me } from '../../api/types';
import { Sheet } from '../../components/overlays';
import { RemotePhoto } from '../../components/photos';
import { Await, Card, Empty } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { fmt, fmtTs, hhmm } from '../../lib/format';
import { confirmBox, haptic } from '../../lib/telegram';
import { closeSheet, openSheet, toast } from '../../store/ui';

export default function HistoryView() {
  const q = useHistory();
  return <Await q={q}>{items => <History items={items} />}</Await>;
}

function History({ items }: { items: Closing[] }) {
  const me = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, action: string, ok: string, ask?: string) => {
    if (ask && !(await confirmBox(ask))) return;
    setBusy(key);
    try { await call(action); if (ask) haptic('success'); toast(ok); } catch (e) { toast(errMsg(e)); }
    setBusy(null);
  };
  const day = (d: string) => new Date(d + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
  const rep = me.isAdmin && (
    <Card>
      <h2>🏆 Итоги 2 недель</h2>
      <p className="sub">Рейтинг, кто сколько заготовок сварил. Приходит в группу сам раз в 2 недели в понедельник в 12:00</p>
      <button className="btn soft" disabled={busy === 'r'} onClick={() => run('r', 'reportNow', 'Итоги отправлены в группу 🏆', 'Отправить в группу итоги заготовок за последние 2 недели?')}>Отправить итоги сейчас</button>
      <button className="btn soft" style={{ marginTop: 8 }} disabled={busy === 'w'} onClick={() => run('w', 'weekNow', 'Сводка отправлена тебе в личку 📊')}>📊 Сводка недели мне в личку</button>
      <button className="btn soft" style={{ marginTop: 8 }} disabled={busy === 'b'} onClick={() => run('b', 'briefNow', 'Брифинг отправлен тебе в личку ☀️')}>☀️ Утренний брифинг мне в личку</button>
    </Card>
  );
  if (!items.length) return <>{rep}<Empty icon="📜" title="Закрытий пока нет" text="Здесь появится история каждого закрытия смены." /></>;
  return (
    <>
      {rep}
      <Card><h2>История закрытий</h2><p className="sub">Последние 7 дней. Нажми, чтобы посмотреть подробно</p></Card>
      {items.map((x, k) => {
        const c = x.checks, okAll = c && c.done === c.total;
        return (
          <div className="card hcard" key={k} onClick={() => openSheet(<ClosingSheet x={x} me={me} />)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="pname"><b style={{ fontSize: 17 }}>{day(x.date)}</b><span>{x.by} · {hhmm(x.ts)}</span></div>
              <span style={{ color: 'var(--muted)', fontSize: 22 }}>›</span>
            </div>
            <div className="hmeta">
              {c && <span className="badge" style={okAll ? undefined : { background: 'var(--warm-soft)', color: 'var(--warm)' }}>чек-лист {c.done}/{c.total}</span>}
              <span className="badge">📷 {(x.photos || []).length}</span>
              <span className="badge">остатки: {Object.keys(x.values || {}).length}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

function ClosingSheet({ x, me }: { x: Closing; me: Me }) {
  const byId = Object.fromEntries(me.preps.map(p => [p.id, p]));
  const c = x.checks, ids = x.photos || [];
  const vals = Object.keys(x.values || {}).filter(id => byId[id]);
  return (
    <Sheet>
      <h2>{new Date(x.date + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}</h2>
      <p className="sub" style={{ marginTop: 4 }}>Закрыл(а): <b>{x.by}</b> · {fmtTs(x.ts)}</p>
      {ids.length
        ? <><h3>Фото ({ids.length})</h3><div className="photos">{ids.map(id => <RemotePhoto key={id} id={id} />)}</div></>
        : <><h3>Фото</h3><p className="sub">Фото не приложены</p></>}
      {c && <>
        <h3>Чек-лист {c.done}/{c.total}</h3>
        <div className="card" style={{ padding: '4px 14px' }}>
          {c.items
            ? c.items.map((i, k) => <div key={k} className={'chk-row' + (i.ok ? '' : ' no')}><span>{i.ok ? '✅' : '❌'}</span><span>{i.t}</span></div>)
            : c.missing.length ? c.missing.map((t, k) => <div key={k} className="chk-row no"><span>❌</span><span>{t}</span></div>) : <p className="sub">Всё отмечено ✅</p>}
        </div>
      </>}
      <h3>Остатки</h3>
      <div className="card" style={{ padding: '4px 14px' }}>
        {vals.length ? vals.map(id => {
          const p = byId[id], v = x.values![id];
          return <div key={id} className={'hrow' + (v < p.min ? ' low' : '')}><span>{p.name}</span><b>{fmt(v)} {p.unit}</b></div>;
        }) : <p className="sub">Нет данных</p>}
      </div>
      <button className="btn soft" onClick={closeSheet}>Закрыть</button>
    </Sheet>
  );
}
